import React, { useEffect, useState } from 'react';
import { Dimensions, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { subscribeToLikeState, toggleLike } from '../services/posts';
import type { Post } from '../types/post';

const { width, height } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 60;

type Props = {
  post: Post;
  isActive: boolean;
  onPressAuthor: () => void;
};

export default function VideoCard({ post, isActive, onPressAuthor }: Props) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);

  const player = useVideoPlayer(post.videoUrl, (p) => {
    p.loop = true;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  useEffect(() => {
    if (!user) return;
    return subscribeToLikeState(post.id, user.uid, setLiked);
  }, [post.id, user]);

  const handleLike = () => {
    if (!user) return;
    toggleLike(post.id, user.uid).catch(() => {});
  };

  const handleShare = () => {
    Share.share({
      message: post.caption ? `${post.caption}\n${post.videoUrl}` : post.videoUrl,
      url: post.videoUrl,
    }).catch(() => {});
  };

  const togglePlayback = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  return (
    <Pressable style={[styles.card, { width, height: height - TAB_BAR_HEIGHT }]} onPress={togglePlayback}>
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

      <View style={styles.rightActions}>
        <Pressable onPress={onPressAuthor} style={styles.avatarPlaceholder} hitSlop={8}>
          <Text style={styles.avatarInitial}>{post.username.charAt(0).toUpperCase()}</Text>
        </Pressable>

        <Pressable onPress={handleLike} style={styles.actionItem} hitSlop={8}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={30} color={liked ? colors.pink : colors.text} />
          <Text style={styles.actionLabel}>{post.likesCount}</Text>
        </Pressable>

        <View style={styles.actionItem}>
          <Ionicons name="chatbubble-ellipses" size={30} color={colors.text} />
          <Text style={styles.actionLabel}>0</Text>
        </View>

        <Pressable onPress={handleShare} style={styles.actionItem} hitSlop={8}>
          <Ionicons name="arrow-redo" size={30} color={colors.text} />
        </Pressable>

        <View style={styles.discSpin}>
          <Image source={{ uri: post.thumbnailUrl }} style={styles.discImage} />
        </View>
      </View>

      <View style={styles.bottomInfo}>
        <Pressable onPress={onPressAuthor} hitSlop={8}>
          <Text style={styles.username}>{post.username}</Text>
        </Pressable>
        {post.caption ? <Caption text={post.caption} /> : null}
      </View>
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
});
