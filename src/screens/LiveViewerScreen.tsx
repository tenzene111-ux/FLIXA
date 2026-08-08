import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AudioSession, isTrackReference, LiveKitRoom, useTracks, VideoTrack } from '@livekit/react-native';
import { Track } from 'livekit-client';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import {
  bumpLiveLike,
  getLiveKitToken,
  joinAsViewer,
  leaveAsViewer,
  sendLiveComment,
  subscribeToActiveLivePoll,
  subscribeToLiveComments,
  subscribeToLiveStream,
  subscribeToMyQuestionUpvote,
  subscribeToQuestions,
  subscribeToViewerCount,
  submitQuestion,
  toggleQuestionUpvote,
} from '../services/live';
import { sendGift } from '../services/wallet';
import { subscribeToGiftLeaderboard, type GiftLeaderboardEntry } from '../services/gifts';
import { getErrorMessage } from '../utils/errors';
import LiveGoalBar from '../components/LiveGoalBar';
import LivePinnedBanner from '../components/LivePinnedBanner';
import LivePollCard from '../components/LivePollCard';
import type { LiveComment, LiveQuestion, LiveStream } from '../types/liveStream';
import type { LivePoll } from '../types/livePoll';
import type { HomeStackParamList } from '../navigation/HomeStackNavigator';

export default function LiveViewerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const route = useRoute<RouteProp<HomeStackParamList, 'LiveViewer'>>();
  const { user } = useAuth();
  const { streamId } = route.params;

  const [stream, setStream] = useState<LiveStream | null>(null);
  const [session, setSession] = useState<{ token: string; serverUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeToLiveStream(streamId, setStream), [streamId]);

  useEffect(() => {
    AudioSession.startAudioSession();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    joinAsViewer(streamId, user.uid).catch(() => {});
    return () => {
      leaveAsViewer(streamId, user.uid).catch(() => {});
    };
  }, [streamId, user]);

  useEffect(() => {
    getLiveKitToken({ roomName: streamId, canPublish: false })
      .then((result) => setSession(result.data))
      .catch((err) => setError(getErrorMessage(err, "Couldn't join this stream.")));
  }, [streamId]);

  useEffect(() => {
    if (stream && !stream.isLive) {
      Alert.alert('Stream ended', 'This live stream has ended.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    }
  }, [stream?.isLive]);

  if (error) {
    return (
      <View style={[styles.setupContainer, { paddingTop: insets.top + 24 }]}>
        <TouchableOpacity onPress={navigation.goBack} style={styles.closeButton} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.setupTitle}>{error}</Text>
      </View>
    );
  }

  if (!session || !stream) {
    return (
      <View style={[styles.setupContainer, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <LiveKitRoom serverUrl={session.serverUrl} token={session.token} connect audio={false} video={false}>
      <ViewerWatchView stream={stream} onClose={() => navigation.goBack()} />
    </LiveKitRoom>
  );
}

type FloatingHeart = { id: number; anim: Animated.Value };

function ViewerWatchView({ stream: initialStream, onClose }: { stream: LiveStream; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const viewerProfile = useUserProfile(user?.uid);
  const tracks = useTracks([Track.Source.Camera]);
  const hostTrack = tracks[0];

  const [stream, setStream] = useState<LiveStream>(initialStream);
  const [viewerCount, setViewerCount] = useState(0);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [chatText, setChatText] = useState('');
  const [sendingGift, setSendingGift] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<GiftLeaderboardEntry[]>([]);
  const [raisedDiamonds, setRaisedDiamonds] = useState(0);
  const [activePoll, setActivePoll] = useState<LivePoll | null>(null);
  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  const [qaModalVisible, setQaModalVisible] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const giftBurst = React.useRef(new Animated.Value(0)).current;
  const heartIdRef = useRef(0);

  useEffect(() => subscribeToLiveStream(stream.id, (updated) => updated && setStream(updated)), [stream.id]);
  useEffect(() => subscribeToViewerCount(stream.id, setViewerCount), [stream.id]);
  useEffect(() => subscribeToLiveComments(stream.id, setComments), [stream.id]);
  useEffect(() => subscribeToActiveLivePoll(stream.id, setActivePoll), [stream.id]);
  useEffect(() => subscribeToQuestions(stream.id, setQuestions), [stream.id]);
  useEffect(
    () =>
      subscribeToGiftLeaderboard('liveStream', stream.id, (entries) =>
        setRaisedDiamonds(entries.reduce((sum, entry) => sum + entry.totalDiamonds, 0))
      ),
    [stream.id]
  );

  useEffect(() => {
    if (!showLeaderboard) return;
    return subscribeToGiftLeaderboard('liveStream', stream.id, setLeaderboard);
  }, [showLeaderboard, stream.id]);

  const highlightedQuestion = useMemo(
    () => questions.find((question) => question.id === stream.highlightedQuestionId) ?? null,
    [questions, stream.highlightedQuestionId]
  );

  const handleSendChat = () => {
    if (!user || !viewerProfile || !chatText.trim()) return;
    sendLiveComment(stream.id, user.uid, viewerProfile.username, chatText).catch(() => {});
    setChatText('');
  };

  const handleTapHeart = () => {
    bumpLiveLike(stream.id);
    const id = heartIdRef.current++;
    const anim = new Animated.Value(0);
    setHearts((prev) => [...prev, { id, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 1500, useNativeDriver: true }).start(() => {
      setHearts((prev) => prev.filter((heart) => heart.id !== id));
    });
  };

  const triggerGiftBurst = () => {
    giftBurst.setValue(0);
    Animated.sequence([
      Animated.spring(giftBurst, { toValue: 1, useNativeDriver: true, friction: 4 }),
      Animated.timing(giftBurst, { toValue: 0, duration: 300, delay: 500, useNativeDriver: true }),
    ]).start();
  };

  const handleSendGift = () => {
    if (!user || !viewerProfile || sendingGift) return;
    setSendingGift(true);
    sendGift({ contextType: 'liveStream', contextId: stream.id, toUid: stream.hostUid, fromUsername: viewerProfile.username })
      .then(() => triggerGiftBurst())
      .catch((error) => {
        Alert.alert("Couldn't send gift", getErrorMessage(error, 'Check your wallet balance and try again.'));
      })
      .finally(() => setSendingGift(false));
  };

  const handleSubmitQuestion = () => {
    if (!user || !viewerProfile || !questionText.trim()) return;
    submitQuestion(stream.id, user.uid, viewerProfile.username, questionText).catch(() => {});
    setQuestionText('');
  };

  return (
    <View style={styles.broadcastContainer}>
      {hostTrack && isTrackReference(hostTrack) ? (
        <VideoTrack trackRef={hostTrack} style={StyleSheet.absoluteFillObject} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.cameraPlaceholder]}>
          <Text style={styles.waitingLabel}>Waiting for host's video...</Text>
        </View>
      )}

      <Animated.View
        style={[
          styles.giftBurst,
          {
            opacity: giftBurst,
            transform: [{ scale: giftBurst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.3] }) }],
          },
        ]}
        pointerEvents="none"
      >
        <Ionicons name="gift" size={100} color={colors.primary} />
      </Animated.View>

      {hearts.map((heart) => (
        <Animated.View
          key={heart.id}
          pointerEvents="none"
          style={[
            styles.floatingHeart,
            {
              opacity: heart.anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: heart.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -260] }) },
                { translateX: heart.anim.interpolate({ inputRange: [0, 1], outputRange: [0, (heart.id % 5) * 12 - 24] }) },
                { scale: heart.anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.5, 1.1, 0.9] }) },
              ],
            },
          ]}
        >
          <Ionicons name="heart" size={30} color={colors.pink} />
        </Animated.View>
      ))}

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.hostInfo}>
          <Text style={styles.hostName} numberOfLines={1}>
            @{stream.hostUsername}
          </Text>
          <Text style={styles.streamTitle} numberOfLines={1}>
            {stream.title}
          </Text>
        </View>
        <View style={styles.viewerBadge}>
          <Ionicons name="eye" size={14} color={colors.text} />
          <Text style={styles.viewerBadgeLabel}>{viewerCount}</Text>
        </View>
      </View>

      <View style={[styles.infoStack, { top: insets.top + 48 }]}>
        {stream.pinnedMessage ? <LivePinnedBanner message={stream.pinnedMessage} /> : null}
        {stream.goalTarget ? <LiveGoalBar raised={raisedDiamonds} target={stream.goalTarget} /> : null}
        {highlightedQuestion ? (
          <View style={styles.highlightedQuestion}>
            <Ionicons name="help-circle" size={14} color={colors.cyan} />
            <Text style={styles.highlightedQuestionText} numberOfLines={2}>
              {highlightedQuestion.username}: {highlightedQuestion.text}
            </Text>
          </View>
        ) : null}
        {stream.hashtags.length > 0 ? (
          <View style={styles.hashtagsRow}>
            {stream.hashtags.slice(0, 4).map((tag) => (
              <Text key={tag} style={styles.hashtagChip}>
                {tag}
              </Text>
            ))}
          </View>
        ) : null}
        {activePoll ? <LivePollCard streamId={stream.id} poll={activePoll} uid={user?.uid} /> : null}
      </View>

      <View style={[styles.rightActions, { bottom: insets.bottom + 140 }]}>
        {stream.allowGifts ? (
          <TouchableOpacity onPress={handleSendGift} style={styles.actionItem} hitSlop={8} disabled={sendingGift}>
            <Ionicons name="gift-outline" size={30} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => setShowLeaderboard(true)} style={styles.actionItem} hitSlop={8}>
          <Ionicons name="trophy-outline" size={28} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setQaModalVisible(true)} style={styles.actionItem} hitSlop={8}>
          <Ionicons name="help-buoy-outline" size={26} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleTapHeart} style={styles.actionItem} hitSlop={8}>
          <Ionicons name="heart-outline" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      {stream.allowComments ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.chatWrap, { paddingBottom: insets.bottom + 12 }]}
        >
          <FlatList
            data={comments.slice(-30)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Text style={styles.chatLine}>
                <Text style={styles.chatUsername}>{item.username}: </Text>
                {item.text}
              </Text>
            )}
            style={styles.chatList}
          />
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder="Say something..."
              placeholderTextColor={colors.textDim}
              value={chatText}
              onChangeText={setChatText}
            />
            <TouchableOpacity onPress={handleSendChat} hitSlop={8}>
              <Ionicons name="send" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : null}

      <Modal visible={showLeaderboard} transparent animationType="slide" onRequestClose={() => setShowLeaderboard(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Top Gifters</Text>
              <TouchableOpacity onPress={() => setShowLeaderboard(false)} hitSlop={8}>
                <Text style={styles.modalDone}>Done</Text>
              </TouchableOpacity>
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

      <Modal visible={qaModalVisible} transparent animationType="slide" onRequestClose={() => setQaModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Q&amp;A</Text>
              <TouchableOpacity onPress={() => setQaModalVisible(false)} hitSlop={8}>
                <Text style={styles.modalDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.qaSubmitRow}>
              <TextInput
                style={[styles.modalInput, styles.qaSubmitInput]}
                placeholder="Ask the host a question..."
                placeholderTextColor={colors.textDim}
                value={questionText}
                onChangeText={setQuestionText}
              />
              <TouchableOpacity onPress={handleSubmitQuestion} hitSlop={8}>
                <Ionicons name="send" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={questions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.qaList}
              ListEmptyComponent={<Text style={styles.leaderboardEmpty}>No questions yet — ask one!</Text>}
              renderItem={({ item }) => <QuestionRow streamId={stream.id} question={item} uid={user?.uid} />}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function QuestionRow({ streamId, question, uid }: { streamId: string; question: LiveQuestion; uid: string | undefined }) {
  const [upvoted, setUpvoted] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeToMyQuestionUpvote(streamId, question.id, uid, setUpvoted);
  }, [streamId, question.id, uid]);

  const handleToggle = () => {
    if (!uid) return;
    toggleQuestionUpvote(streamId, question.id, uid, upvoted).catch(() => {});
  };

  return (
    <View style={styles.qaRow}>
      <View style={styles.qaRowText}>
        <Text style={styles.qaUsername}>{question.username}</Text>
        <Text style={styles.qaQuestion} numberOfLines={2}>
          {question.text}
        </Text>
      </View>
      <TouchableOpacity onPress={handleToggle} style={styles.qaUpvotes} hitSlop={8}>
        <Ionicons name={upvoted ? 'arrow-up-circle' : 'arrow-up-circle-outline'} size={20} color={colors.cyan} />
        <Text style={styles.qaUpvoteCount}>{question.upvoteCount}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  setupContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centered: {
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    top: 16,
  },
  setupTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 60,
    textAlign: 'center',
  },
  broadcastContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cameraPlaceholder: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  giftBurst: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    marginLeft: -50,
    marginTop: -50,
  },
  floatingHeart: {
    position: 'absolute',
    bottom: 160,
    right: 24,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoStack: {
    position: 'absolute',
    left: 16,
    right: 90,
    gap: 8,
  },
  hostInfo: {
    flex: 1,
  },
  hostName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  streamTitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  viewerBadgeLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  highlightedQuestion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  highlightedQuestionText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  hashtagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hashtagChip: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 20,
  },
  actionItem: {
    alignItems: 'center',
  },
  chatWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '40%',
    paddingRight: 70,
  },
  chatList: {
    paddingHorizontal: 16,
  },
  chatLine: {
    color: colors.text,
    fontSize: 13,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  chatUsername: {
    fontWeight: '700',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  chatInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
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
    maxHeight: '65%',
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
  modalInput: {
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  qaSubmitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  qaSubmitInput: {
    flex: 1,
  },
  qaList: {
    padding: 16,
    flexGrow: 1,
  },
  qaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  qaRowText: {
    flex: 1,
  },
  qaUsername: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  qaQuestion: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  qaUpvotes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  qaUpvoteCount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
});
