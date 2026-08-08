import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { incrementView, subscribeToLikeState, toggleLike } from '../services/posts';
import { reportPost } from '../services/moderation';
import { logEvent } from '../services/analytics';
import { subscribeIsSaved, toggleSave } from '../services/savedVideos';
import { sendGift } from '../services/wallet';
import { subscribeToGiftLeaderboard, subscribeToLatestGift, type GiftLeaderboardEntry } from '../services/gifts';
import { getErrorMessage } from '../utils/errors';
import GiftAnimationOverlay, { type GiftAnimationEvent } from './GiftAnimationOverlay';
import GiftPicker from './GiftPicker';
import OverlayLayer from './OverlayLayer';
import PollCard from './PollCard';
import { GIFT_BY_ID, type GiftDefinition } from '../types/gift';
import type { Post } from '../types/post';

const { width } = Dimensions.get('window');
const DOUBLE_TAP_WINDOW_MS = 300;
const SWIPE_TRIGGER_DISTANCE = 60;

type Props = {
  post: Post;
  isActive: boolean;
  height: number;
  onPressAuthor: () => void;
  onPressComments: () => void;
  onNotInterested: () => void;
};

export default function VideoCard({ post, isActive, height, onPressAuthor, onPressComments, onNotInterested }: Props) {
  const { user } = useAuth();
  const author = useUserProfile(post.uid);
  const viewerProfile = useUserProfile(user?.uid);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendingGift, setSendingGift] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<GiftLeaderboardEntry[]>([]);
  const [giftPickerVisible, setGiftPickerVisible] = useState(false);
  const [giftEvent, setGiftEvent] = useState<GiftAnimationEvent | null>(null);
  const lastTapRef = useRef(0);
  const heartBurst = useRef(new Animated.Value(0)).current;
  const discRotation = useRef(new Animated.Value(0)).current;
  const discAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const player = useVideoPlayer(post.videoUrl, (p) => {
    p.loop = true;
    p.timeUpdateEventInterval = 0.25;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
  const trimStart = post.trimStart ?? 0;
  const trimEnd = post.trimEnd && post.trimEnd > trimStart ? post.trimEnd : player.duration;
  const trimWindow = Math.max(0, trimEnd - trimStart);
  const progress = trimWindow > 0 ? Math.min(1, Math.max(0, (currentTime - trimStart) / trimWindow)) : 0;

  useEffect(() => {
    if (isActive) {
      player.currentTime = trimStart;
      player.play();
      incrementView(post.id);
      if (user) logEvent('video_view', user.uid, { postId: post.id });
    } else {
      player.pause();
    }
  }, [isActive, player]);

  // Loop within the trimmed window instead of the whole file once trim
  // bounds are set on the post.
  useEffect(() => {
    if (!isActive || !post.trimEnd) return;
    if (currentTime < trimStart || currentTime >= trimEnd) {
      player.currentTime = trimStart;
    }
  }, [currentTime, isActive]);

  useEffect(() => {
    if (!user) return;
    return subscribeToLikeState(post.id, user.uid, setLiked);
  }, [post.id, user]);

  useEffect(() => {
    if (!user) return;
    return subscribeIsSaved(user.uid, post.id, setSaved);
  }, [post.id, user]);

  // Only subscribed while the leaderboard modal is actually open, so idle
  // feed cards don't each carry a live gifts listener.
  useEffect(() => {
    if (!showLeaderboard) return;
    return subscribeToGiftLeaderboard('video', post.id, setLeaderboard);
  }, [showLeaderboard, post.id]);

  // Plays the gift animation for whoever is watching this card right
  // now, not just whoever sent it — only wired up while the card is
  // actually active/on-screen.
  useEffect(() => {
    if (!isActive) return;
    return subscribeToLatestGift('video', post.id, (event) => {
      const gift = GIFT_BY_ID[event.giftId];
      if (!gift) return;
      setGiftEvent({ id: event.id, gift, fromUsername: event.fromUsername });
    });
  }, [isActive, post.id]);

  useEffect(() => {
    if (isPlaying) {
      discAnimationRef.current = Animated.loop(
        Animated.timing(discRotation, { toValue: 1, duration: 3000, useNativeDriver: true })
      );
      discAnimationRef.current.start();
    } else {
      discAnimationRef.current?.stop();
    }
    return () => discAnimationRef.current?.stop();
  }, [isPlaying]);

  const handleLike = (fromDoubleTap = false) => {
    if (!user || !viewerProfile) return;
    if (fromDoubleTap && liked) return;
    toggleLike({
      postId: post.id,
      postOwnerUid: post.uid,
      postThumbnailUrl: post.thumbnailUrl,
      likerUid: user.uid,
      likerUsername: viewerProfile.username,
    }).catch(() => {});
    logEvent(liked ? 'unlike' : 'like', user.uid, { postId: post.id });
  };

  const handleSave = () => {
    if (!user) return;
    toggleSave(user.uid, post.id, saved).catch(() => {});
    logEvent(saved ? 'unsave' : 'save', user.uid, { postId: post.id });
  };

  const handleOpenGiftPicker = () => {
    if (!user) return;
    if (user.uid === post.uid) {
      Alert.alert("Can't gift your own video");
      return;
    }
    setGiftPickerVisible(true);
  };

  const handleSelectGift = (gift: GiftDefinition) => {
    if (!user || sendingGift || !viewerProfile) return;
    setSendingGift(true);
    setGiftPickerVisible(false);
    // The animation itself is driven by the subscribeToLatestGift
    // listener above (which fires for every viewer, sender included)
    // once the write actually lands — not optimistically here.
    sendGift({
      contextType: 'video',
      contextId: post.id,
      toUid: post.uid,
      fromUsername: viewerProfile.username,
      giftId: gift.id,
    })
      .then(() => {
        logEvent('gift_sent', user.uid, { postId: post.id, giftId: gift.id });
      })
      .catch((error) => {
        Alert.alert("Couldn't send gift", getErrorMessage(error, 'Check your wallet balance and try again.'));
      })
      .finally(() => setSendingGift(false));
  };

  const handleShare = () => {
    Share.share({
      message: post.caption ? `${post.caption}\n${post.videoUrl}` : post.videoUrl,
      url: post.videoUrl,
    }).catch(() => {});
    if (user) logEvent('share', user.uid, { postId: post.id });
  };

  const triggerHeartBurst = () => {
    heartBurst.setValue(0);
    Animated.sequence([
      Animated.spring(heartBurst, { toValue: 1, useNativeDriver: true, friction: 4 }),
      Animated.timing(heartBurst, { toValue: 0, duration: 250, delay: 350, useNativeDriver: true }),
    ]).start();
  };

  const handlePress = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }

    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_WINDOW_MS) {
      handleLike(true);
      triggerHeartBurst();
    }
    lastTapRef.current = now;
  };

  const handleMoreOptions = () => {
    Alert.alert('Video options', undefined, [
      { text: 'Not interested', onPress: onNotInterested },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Report video', 'Why are you reporting this?', [
            { text: 'Spam', onPress: () => submitReport('spam') },
            { text: 'Inappropriate', onPress: () => submitReport('inappropriate') },
            { text: 'Other', onPress: () => submitReport('other') },
            { text: 'Cancel', style: 'cancel' },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submitReport = (reason: 'spam' | 'inappropriate' | 'other') => {
    if (!user) return;
    reportPost({ postId: post.id, reporterUid: user.uid, reason })
      .then(() => Alert.alert('Thanks', "We've received your report."))
      .catch(() => {});
  };

  // A swipe (left or right) jumps to the creator's profile, same as tapping
  // the avatar/username. The PanResponder lives on the wrapper View so it
  // can steal a clearly-horizontal drag away from the inner Pressable
  // (which owns tap/double-tap/long-press) without interfering with the
  // FlatList's vertical paging.
  const onPressAuthorRef = useRef(onPressAuthor);
  onPressAuthorRef.current = onPressAuthor;
  const swipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) > SWIPE_TRIGGER_DISTANCE) {
          onPressAuthorRef.current();
        }
      },
    })
  ).current;

  const displayUsername = author?.username ?? '...';
  const discSpin = discRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ width, height }} {...swipeResponder.panHandlers}>
      <Pressable style={[styles.card, { width, height }]} onPress={handlePress} onLongPress={handleMoreOptions}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        pointerEvents="none"
      />

      {!isPlaying && (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <Ionicons name="play" size={64} color="rgba(255,255,255,0.85)" />
        </View>
      )}

      <View style={styles.scrim} pointerEvents="none" />

      {post.overlays.length > 0 ? <OverlayLayer overlays={post.overlays} /> : null}

      <Animated.View
        style={[
          styles.heartBurst,
          {
            opacity: heartBurst,
            transform: [{ scale: heartBurst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.3] }) }],
          },
        ]}
        pointerEvents="none"
      >
        <Ionicons name="heart" size={110} color={colors.pink} />
      </Animated.View>

      <GiftAnimationOverlay event={giftEvent} onDone={() => setGiftEvent(null)} />

      <TouchableMoreButton onPress={handleMoreOptions} />

      <View style={styles.rightActions}>
        <Pressable onPress={onPressAuthor} style={styles.avatarPlaceholder} hitSlop={8}>
          {author?.photoURL ? (
            <Image source={{ uri: author.photoURL }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitial}>{displayUsername.charAt(0).toUpperCase()}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => handleLike(false)} style={styles.actionItem} hitSlop={8}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={30} color={liked ? colors.pink : colors.text} />
          <Text style={styles.actionLabel}>{post.likesCount}</Text>
        </Pressable>

        <Pressable onPress={onPressComments} style={styles.actionItem} hitSlop={8}>
          <Ionicons name="chatbubble-ellipses" size={30} color={colors.text} />
          <Text style={styles.actionLabel}>{post.commentsCount}</Text>
        </Pressable>

        <Pressable onPress={handleShare} style={styles.actionItem} hitSlop={8}>
          <Ionicons name="arrow-redo" size={30} color={colors.text} />
        </Pressable>

        <Pressable onPress={handleSave} style={styles.actionItem} hitSlop={8}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={28} color={saved ? colors.primary : colors.text} />
        </Pressable>

        <Pressable onPress={handleOpenGiftPicker} style={styles.actionItem} hitSlop={8} disabled={sendingGift}>
          <Ionicons name="gift-outline" size={28} color={colors.text} />
        </Pressable>

        <Pressable onPress={() => setShowLeaderboard(true)} style={styles.actionItem} hitSlop={8}>
          <Ionicons name="trophy-outline" size={26} color={colors.text} />
        </Pressable>

        <Animated.View style={[styles.discSpin, { transform: [{ rotate: discSpin }] }]}>
          <Image source={{ uri: post.thumbnailUrl }} style={styles.discImage} />
        </Animated.View>
      </View>

      {post.poll && isActive ? (
        <View style={styles.pollWrap}>
          <PollCard videoId={post.id} poll={post.poll} uid={user?.uid} />
        </View>
      ) : null}

      <View style={styles.bottomInfo}>
        <Pressable onPress={onPressAuthor} hitSlop={8}>
          <Text style={styles.username}>@{displayUsername}</Text>
        </Pressable>
        {post.caption ? <Caption text={post.caption} /> : null}
        {post.musicTitle ? (
          <View style={styles.musicRow}>
            <Ionicons name="musical-notes" size={13} color={colors.text} />
            <Text style={styles.musicLabel} numberOfLines={1}>
              {post.musicTitle}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.progressTrack} pointerEvents="none">
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      </Pressable>

      <Modal visible={showLeaderboard} transparent animationType="slide" onRequestClose={() => setShowLeaderboard(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Top Gifters</Text>
              <Pressable onPress={() => setShowLeaderboard(false)} hitSlop={8}>
                <Text style={styles.modalDone}>Done</Text>
              </Pressable>
            </View>
            <FlatList
              data={leaderboard}
              keyExtractor={(item) => item.uid}
              contentContainerStyle={styles.leaderboardList}
              ListEmptyComponent={<Text style={styles.leaderboardEmpty}>No gifts yet</Text>}
              renderItem={({ item, index }) => (
                <View style={styles.leaderboardRow}>
                  <Text style={styles.leaderboardRank}>#{index + 1}</Text>
                  <Text style={styles.leaderboardName} numberOfLines={1}>
                    @{item.username}
                  </Text>
                  <View style={styles.leaderboardAmount}>
                    <Ionicons name="diamond" size={13} color={colors.cyan} />
                    <Text style={styles.leaderboardAmountLabel}>{item.totalDiamonds}</Text>
                  </View>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      <GiftPicker
        visible={giftPickerVisible}
        onClose={() => setGiftPickerVisible(false)}
        onSelectGift={handleSelectGift}
        sending={sendingGift}
        recipientLabel={`@${displayUsername}`}
      />
    </View>
  );
}

function TouchableMoreButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.moreButton} hitSlop={8}>
      <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
    </Pressable>
  );
}

function Caption({ text }: { text: string }) {
  const parts = text.split(/(#[a-zA-Z0-9_]+)/g);
  return (
    <Text style={styles.caption}>
      {parts.map((part, index) =>
        part.startsWith('#') ? (
          <Text key={index} style={styles.hashtag}>
            {part}
          </Text>
        ) : (
          <Text key={index}>{part}</Text>
        )
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    justifyContent: 'flex-end',
    backgroundColor: colors.background,
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,3,15,0.15)',
  },
  heartBurst: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -55,
    marginTop: -55,
  },
  moreButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: 110,
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.text,
    marginBottom: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  actionItem: {
    alignItems: 'center',
    marginBottom: 18,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  discSpin: {
    marginTop: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.surface,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  discImage: {
    width: '100%',
    height: '100%',
  },
  pollWrap: {
    paddingHorizontal: 16,
    paddingRight: 90,
    marginBottom: 12,
  },
  bottomInfo: {
    paddingHorizontal: 16,
    paddingRight: 90,
    paddingBottom: 20,
  },
  username: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  caption: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
  },
  hashtag: {
    color: colors.cyan,
    fontWeight: '600',
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  musicLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.text,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  modalDone: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  leaderboardList: {
    padding: 16,
    flexGrow: 1,
  },
  leaderboardEmpty: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  leaderboardRank: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    width: 28,
  },
  leaderboardName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  leaderboardAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leaderboardAmountLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
