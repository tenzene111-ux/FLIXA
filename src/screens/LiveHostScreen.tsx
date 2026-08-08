import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { AudioSession, LiveKitRoom, useLocalParticipant, useTracks } from '@livekit/react-native';
import { Track } from 'livekit-client';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import {
  acceptGuestRequest,
  createLivePoll,
  createLiveStream,
  endLivePoll,
  endLiveStream,
  getLiveKitToken,
  rejectGuestRequest,
  removeLiveGuest,
  setHighlightedQuestion,
  setLivePinnedMessage,
  subscribeToActiveLivePoll,
  subscribeToBlockedUsers,
  subscribeToCoHosts,
  subscribeToLiveComments,
  subscribeToLiveStream,
  subscribeToLivePollVotes,
  subscribeToModerators,
  subscribeToPendingGuestRequests,
  subscribeToQuestions,
  subscribeToViewerCount,
  uploadLiveCover,
} from '../services/live';
import { subscribeToGiftLeaderboard } from '../services/gifts';
import { getErrorMessage } from '../utils/errors';
import LiveChatPanel from '../components/LiveChatPanel';
import LiveGoalBar from '../components/LiveGoalBar';
import LivePinnedBanner from '../components/LivePinnedBanner';
import LiveStageGrid from '../components/LiveStageGrid';
import { LIVE_CATEGORIES, type LiveCategory, type LiveComment, type LiveQuestion, type LiveStream } from '../types/liveStream';
import type { LivePoll } from '../types/livePoll';
import type { LiveCoHost, LiveGuestRequest } from '../types/liveGuest';
import type { HomeStackParamList } from '../navigation/HomeStackNavigator';

export default function LiveHostScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const { user } = useAuth();
  const profile = useUserProfile(user?.uid);

  const [title, setTitle] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [category, setCategory] = useState<LiveCategory>('Other');
  const [hashtagsText, setHashtagsText] = useState('');
  const [allowComments, setAllowComments] = useState(true);
  const [allowGifts, setAllowGifts] = useState(true);
  const [goalText, setGoalText] = useState('');

  const [streamId, setStreamId] = useState<string | null>(null);
  const [session, setSession] = useState<{ token: string; serverUrl: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  useEffect(() => {
    AudioSession.startAudioSession();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  useEffect(() => {
    if (!cameraPermission?.granted) requestCameraPermission();
    if (!micPermission?.granted) requestMicPermission();
  }, []);

  const handlePickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo library permission needed', 'Enable photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri);
    }
  };

  const handleGoLive = async () => {
    if (!user || !profile || starting) return;
    if (!cameraPermission?.granted || !micPermission?.granted) {
      Alert.alert(
        'Camera & microphone needed',
        'Enable camera and microphone access in Settings to go live.'
      );
      return;
    }
    setStarting(true);
    try {
      const coverUrl = coverUri ? await uploadLiveCover(user.uid, coverUri) : null;
      const hashtags = Array.from(
        new Set(
          hashtagsText
            .split(/[\s,]+/)
            .map((tag) => tag.trim().replace(/^#/, ''))
            .filter(Boolean)
            .map((tag) => `#${tag}`)
        )
      );
      const goalTarget = goalText.trim() ? Math.max(0, parseInt(goalText.trim(), 10) || 0) : null;
      const id = await createLiveStream(user.uid, profile.username, {
        title: title.trim() || `${profile.username}'s live`,
        coverUrl,
        category,
        hashtags,
        allowComments,
        allowGifts,
        goalTarget: goalTarget && goalTarget > 0 ? goalTarget : null,
      });
      const result = await getLiveKitToken({ roomName: id, canPublish: true });
      setStreamId(id);
      setSession(result.data);
    } catch (error) {
      Alert.alert("Couldn't go live", getErrorMessage(error, 'Please try again.'));
    } finally {
      setStarting(false);
    }
  };

  const handleEnd = async () => {
    if (streamId) await endLiveStream(streamId).catch(() => {});
    setStreamId(null);
    setSession(null);
    navigation.goBack();
  };

  if (!session || !streamId) {
    return (
      <ScrollView
        style={styles.setupScroll}
        contentContainerStyle={[styles.setupContainer, { paddingTop: insets.top + 24 }]}
      >
        <TouchableOpacity onPress={navigation.goBack} style={styles.closeButton} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.setupTitle}>Go Live</Text>

        <TouchableOpacity style={styles.coverPicker} onPress={handlePickCover} activeOpacity={0.85}>
          {coverUri ? (
            <View style={styles.coverPreviewWrap}>
              <Ionicons name="image" size={20} color={colors.textMuted} />
              <Text style={styles.coverChangeLabel}>Change cover</Text>
            </View>
          ) : (
            <>
              <Ionicons name="camera-outline" size={26} color={colors.textMuted} />
              <Text style={styles.coverChangeLabel}>Add cover</Text>
            </>
          )}
        </TouchableOpacity>

        <TextInput
          style={styles.titleInput}
          placeholder="Give your stream a title"
          placeholderTextColor={colors.textDim}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.sectionLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          {LIVE_CATEGORIES.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, category === item && styles.chipActive]}
              onPress={() => setCategory(item)}
            >
              <Text style={[styles.chipLabel, category === item && styles.chipLabelActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TextInput
          style={styles.titleInput}
          placeholder="Hashtags (comma separated)"
          placeholderTextColor={colors.textDim}
          value={hashtagsText}
          onChangeText={setHashtagsText}
          autoCapitalize="none"
        />

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Allow comments</Text>
          <Switch
            value={allowComments}
            onValueChange={setAllowComments}
            trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Allow gifts</Text>
          <Switch
            value={allowGifts}
            onValueChange={setAllowGifts}
            trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
          />
        </View>

        <TextInput
          style={styles.titleInput}
          placeholder="Diamond goal (optional)"
          placeholderTextColor={colors.textDim}
          value={goalText}
          onChangeText={(value) => setGoalText(value.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
        />

        {cameraPermission && !cameraPermission.granted ? (
          <Text style={styles.permissionNotice}>
            Camera access is required to go live.{' '}
            {cameraPermission.canAskAgain ? (
              <Text style={styles.permissionLink} onPress={requestCameraPermission}>
                Grant access
              </Text>
            ) : (
              'Enable it in your phone Settings.'
            )}
          </Text>
        ) : null}
        {micPermission && !micPermission.granted ? (
          <Text style={styles.permissionNotice}>
            Microphone access is required to go live.{' '}
            {micPermission.canAskAgain ? (
              <Text style={styles.permissionLink} onPress={requestMicPermission}>
                Grant access
              </Text>
            ) : (
              'Enable it in your phone Settings.'
            )}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.goLiveButton, (!cameraPermission?.granted || !micPermission?.granted) && styles.goLiveButtonDisabled]}
          onPress={handleGoLive}
          disabled={starting || !cameraPermission?.granted || !micPermission?.granted}
          activeOpacity={0.85}
        >
          <Text style={styles.goLiveLabel}>{starting ? 'Starting...' : 'Go Live'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={session.serverUrl}
      token={session.token}
      connect
      audio
      video
      options={{ adaptiveStream: { pixelDensity: 'screen' } }}
    >
      <HostBroadcastView streamId={streamId} onEnd={handleEnd} />
    </LiveKitRoom>
  );
}

function HostBroadcastView({ streamId, onEnd }: { streamId: string; onEnd: () => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const profile = useUserProfile(user?.uid);
  const tracks = useTracks([Track.Source.Camera]);
  const { localParticipant } = useLocalParticipant();
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const [stream, setStream] = useState<LiveStream | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [raisedDiamonds, setRaisedDiamonds] = useState(0);
  const [activePoll, setActivePoll] = useState<LivePoll | null>(null);
  const [pollCounts, setPollCounts] = useState<Record<string, number>>({});
  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  const [moderatorUids, setModeratorUids] = useState<Set<string>>(new Set());
  const [blockedUids, setBlockedUids] = useState<Set<string>>(new Set());
  const [guestRequests, setGuestRequests] = useState<LiveGuestRequest[]>([]);
  const [coHosts, setCoHosts] = useState<LiveCoHost[]>([]);

  const [pinnedModalVisible, setPinnedModalVisible] = useState(false);
  const [pinnedDraft, setPinnedDraft] = useState('');
  const [pollModalVisible, setPollModalVisible] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [qaModalVisible, setQaModalVisible] = useState(false);
  const [guestsModalVisible, setGuestsModalVisible] = useState(false);

  useEffect(() => subscribeToLiveStream(streamId, setStream), [streamId]);
  useEffect(() => subscribeToViewerCount(streamId, setViewerCount), [streamId]);
  useEffect(() => subscribeToLiveComments(streamId, setComments), [streamId]);
  useEffect(() => subscribeToQuestions(streamId, setQuestions), [streamId]);
  useEffect(
    () => subscribeToModerators(streamId, (moderators) => setModeratorUids(new Set(moderators.map((m) => m.uid)))),
    [streamId]
  );
  useEffect(
    () => subscribeToBlockedUsers(streamId, (blocked) => setBlockedUids(new Set(blocked.map((b) => b.uid)))),
    [streamId]
  );
  useEffect(() => subscribeToPendingGuestRequests(streamId, setGuestRequests), [streamId]);
  useEffect(() => subscribeToCoHosts(streamId, setCoHosts), [streamId]);
  useEffect(
    () =>
      subscribeToGiftLeaderboard('liveStream', streamId, (entries) =>
        setRaisedDiamonds(entries.reduce((sum, entry) => sum + entry.totalDiamonds, 0))
      ),
    [streamId]
  );
  useEffect(() => subscribeToActiveLivePoll(streamId, setActivePoll), [streamId]);
  useEffect(() => {
    if (!activePoll) {
      setPollCounts({});
      return;
    }
    return subscribeToLivePollVotes(streamId, activePoll.id, setPollCounts);
  }, [streamId, activePoll?.id]);

  const highlightedQuestion = useMemo(
    () => questions.find((question) => question.id === stream?.highlightedQuestionId) ?? null,
    [questions, stream?.highlightedQuestionId]
  );
  const pollTotalVotes = Object.values(pollCounts).reduce((sum, count) => sum + count, 0);

  const handleFlipCamera = async () => {
    const publication = localParticipant.getTrackPublication(Track.Source.Camera);
    const videoTrack = publication?.videoTrack;
    if (!videoTrack) return;
    const next = facingMode === 'user' ? 'environment' : 'user';
    try {
      await videoTrack.restartTrack({ facingMode: next });
      setFacingMode(next);
    } catch {
      // Device may not have a second camera — no-op.
    }
  };

  const handleAcceptGuest = (request: LiveGuestRequest) => {
    acceptGuestRequest(streamId, request.uid, request.username).catch((error) =>
      Alert.alert("Couldn't accept request", getErrorMessage(error, 'Please try again.'))
    );
  };

  const handleRejectGuest = (request: LiveGuestRequest) => {
    rejectGuestRequest(streamId, request.uid).catch(() => {});
  };

  const handleRemoveCoHost = (coHost: LiveCoHost) => {
    removeLiveGuest({ roomName: streamId, uid: coHost.uid }).catch((error) =>
      Alert.alert("Couldn't remove guest", getErrorMessage(error, 'Please try again.'))
    );
  };

  const openPinnedModal = () => {
    setPinnedDraft(stream?.pinnedMessage ?? '');
    setPinnedModalVisible(true);
  };

  const handleSavePinned = () => {
    setLivePinnedMessage(streamId, pinnedDraft.trim() || null).catch(() => {});
    setPinnedModalVisible(false);
  };

  const handleClearPinned = () => {
    setLivePinnedMessage(streamId, null).catch(() => {});
    setPinnedDraft('');
    setPinnedModalVisible(false);
  };

  const handlePollOptionChange = (index: number, value: string) => {
    setPollOptions((prev) => prev.map((option, i) => (i === index ? value : option)));
  };

  const handleAddPollOption = () => {
    setPollOptions((prev) => (prev.length < 4 ? [...prev, ''] : prev));
  };

  const handleRemovePollOption = (index: number) => {
    setPollOptions((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
  };

  const handleCreatePoll = () => {
    const question = pollQuestion.trim();
    const options = pollOptions.map((text) => text.trim()).filter(Boolean);
    if (!question || options.length < 2) {
      Alert.alert('Poll needs a question and at least 2 options');
      return;
    }
    createLivePoll(streamId, { question, options: options.map((text, index) => ({ id: `opt-${index}`, text })) })
      .then(() => {
        setPollQuestion('');
        setPollOptions(['', '']);
        setPollModalVisible(false);
      })
      .catch((error) => Alert.alert("Couldn't start poll", getErrorMessage(error, 'Please try again.')));
  };

  const handleEndPoll = () => {
    if (!activePoll) return;
    endLivePoll(streamId, activePoll.id).catch(() => {});
  };

  const handleToggleHighlight = (questionId: string) => {
    const next = stream?.highlightedQuestionId === questionId ? null : questionId;
    setHighlightedQuestion(streamId, next).catch(() => {});
  };

  return (
    <View style={styles.broadcastContainer}>
      <LiveStageGrid tracks={tracks} />

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeLabel}>LIVE</Text>
        </View>
        <View style={styles.viewerBadge}>
          <Ionicons name="eye" size={14} color={colors.text} />
          <Text style={styles.viewerBadgeLabel}>{viewerCount}</Text>
        </View>
        <View style={styles.viewerBadge}>
          <Ionicons name="heart" size={14} color={colors.pink} />
          <Text style={styles.viewerBadgeLabel}>{stream?.likeCount ?? 0}</Text>
        </View>
        <TouchableOpacity onPress={handleFlipCamera} style={styles.flipButton} hitSlop={8}>
          <Ionicons name="camera-reverse-outline" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onEnd} style={styles.endButton}>
          <Text style={styles.endButtonLabel}>End</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.infoStack, { top: insets.top + 48 }]}>
        {stream?.pinnedMessage ? <LivePinnedBanner message={stream.pinnedMessage} /> : null}
        {stream?.goalTarget ? <LiveGoalBar raised={raisedDiamonds} target={stream.goalTarget} /> : null}
        {highlightedQuestion ? (
          <View style={styles.highlightedQuestion}>
            <Ionicons name="help-circle" size={14} color={colors.cyan} />
            <Text style={styles.highlightedQuestionText} numberOfLines={2}>
              {highlightedQuestion.username}: {highlightedQuestion.text}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.rightActions, { bottom: insets.bottom + 200 }]}>
        <TouchableOpacity onPress={() => setGuestsModalVisible(true)} style={styles.actionItem} hitSlop={8}>
          <Ionicons name="people-outline" size={26} color={colors.text} />
          {guestRequests.length > 0 ? (
            <View style={styles.badgeDot}>
              <Text style={styles.badgeDotLabel}>{guestRequests.length}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity onPress={openPinnedModal} style={styles.actionItem} hitSlop={8}>
          <Ionicons name="pin-outline" size={26} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPollModalVisible(true)} style={styles.actionItem} hitSlop={8}>
          <Ionicons name="stats-chart-outline" size={26} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setQaModalVisible(true)} style={styles.actionItem} hitSlop={8}>
          <Ionicons name="help-buoy-outline" size={26} color={colors.text} />
          {questions.length > 0 ? (
            <View style={styles.badgeDot}>
              <Text style={styles.badgeDotLabel}>{questions.length}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <LiveChatPanel
        streamId={streamId}
        myUid={user?.uid}
        myUsername={profile?.username}
        comments={comments}
        allowComments
        canModerate
        canManageModerators
        moderatorUids={moderatorUids}
        blockedUids={blockedUids}
        iAmBlocked={false}
        bottomInset={insets.bottom}
      />

      <Modal visible={guestsModalVisible} transparent animationType="slide" onRequestClose={() => setGuestsModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Guests</Text>
              <TouchableOpacity onPress={() => setGuestsModalVisible(false)} hitSlop={8}>
                <Text style={styles.modalDone}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.guestsScrollContent}>
              {guestRequests.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>Requests to join</Text>
                  {guestRequests.map((request) => (
                    <View key={request.uid} style={styles.guestRow}>
                      <Text style={styles.guestName} numberOfLines={1}>
                        @{request.username}
                      </Text>
                      <View style={styles.guestActions}>
                        <TouchableOpacity onPress={() => handleRejectGuest(request)} hitSlop={8}>
                          <Ionicons name="close-circle" size={26} color={colors.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleAcceptGuest(request)} hitSlop={8}>
                          <Ionicons name="checkmark-circle" size={26} color={colors.success} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              ) : null}
              <Text style={styles.sectionLabel}>On stage</Text>
              {coHosts.length === 0 ? (
                <Text style={styles.leaderboardEmpty}>No guests on stage</Text>
              ) : (
                coHosts.map((coHost) => (
                  <View key={coHost.uid} style={styles.guestRow}>
                    <Text style={styles.guestName} numberOfLines={1}>
                      @{coHost.username}
                    </Text>
                    <TouchableOpacity onPress={() => handleRemoveCoHost(coHost)} hitSlop={8}>
                      <Text style={styles.removeGuestLabel}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={pinnedModalVisible} transparent animationType="slide" onRequestClose={() => setPinnedModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pinned message</Text>
              <TouchableOpacity onPress={() => setPinnedModalVisible(false)} hitSlop={8}>
                <Text style={styles.modalDone}>Close</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput
                style={styles.modalInput}
                placeholder="Pin a message for your viewers"
                placeholderTextColor={colors.textDim}
                value={pinnedDraft}
                onChangeText={setPinnedDraft}
                multiline
              />
              <View style={styles.modalActionsRow}>
                {stream?.pinnedMessage ? (
                  <TouchableOpacity onPress={handleClearPinned} style={styles.modalSecondaryButton}>
                    <Text style={styles.modalSecondaryLabel}>Unpin</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={handleSavePinned} style={styles.modalPrimaryButton}>
                  <Text style={styles.modalPrimaryLabel}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={pollModalVisible} transparent animationType="slide" onRequestClose={() => setPollModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Live poll</Text>
              <TouchableOpacity onPress={() => setPollModalVisible(false)} hitSlop={8}>
                <Text style={styles.modalDone}>Close</Text>
              </TouchableOpacity>
            </View>
            {activePoll ? (
              <View style={styles.modalBody}>
                <Text style={styles.activePollQuestion}>{activePoll.question}</Text>
                {activePoll.options.map((option) => {
                  const count = pollCounts[option.id] ?? 0;
                  const pct = pollTotalVotes > 0 ? Math.round((count / pollTotalVotes) * 100) : 0;
                  return (
                    <View key={option.id} style={styles.pollResultRow}>
                      <Text style={styles.pollResultLabel} numberOfLines={1}>
                        {option.text}
                      </Text>
                      <Text style={styles.pollResultPct}>{pct}%</Text>
                    </View>
                  );
                })}
                <TouchableOpacity onPress={handleEndPoll} style={styles.modalPrimaryButton}>
                  <Text style={styles.modalPrimaryLabel}>End poll</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.modalBody}>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ask your viewers something..."
                  placeholderTextColor={colors.textDim}
                  value={pollQuestion}
                  onChangeText={setPollQuestion}
                />
                {pollOptions.map((option, index) => (
                  <View key={index} style={styles.pollOptionRow}>
                    <TextInput
                      style={[styles.modalInput, styles.pollOptionInput]}
                      placeholder={`Option ${index + 1}`}
                      placeholderTextColor={colors.textDim}
                      value={option}
                      onChangeText={(value) => handlePollOptionChange(index, value)}
                    />
                    {pollOptions.length > 2 ? (
                      <TouchableOpacity onPress={() => handleRemovePollOption(index)} hitSlop={8}>
                        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
                {pollOptions.length < 4 ? (
                  <TouchableOpacity onPress={handleAddPollOption} style={styles.addOptionButton}>
                    <Text style={styles.addOptionLabel}>+ Add option</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={handleCreatePoll} style={styles.modalPrimaryButton}>
                  <Text style={styles.modalPrimaryLabel}>Start poll</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={qaModalVisible} transparent animationType="slide" onRequestClose={() => setQaModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Q&amp;A</Text>
              <TouchableOpacity onPress={() => setQaModalVisible(false)} hitSlop={8}>
                <Text style={styles.modalDone}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={questions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.qaList}
              ListEmptyComponent={<Text style={styles.leaderboardEmpty}>No questions yet</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.qaRow, stream?.highlightedQuestionId === item.id && styles.qaRowHighlighted]}
                  onPress={() => handleToggleHighlight(item.id)}
                >
                  <View style={styles.qaRowText}>
                    <Text style={styles.qaUsername}>{item.username}</Text>
                    <Text style={styles.qaQuestion} numberOfLines={2}>
                      {item.text}
                    </Text>
                  </View>
                  <View style={styles.qaUpvotes}>
                    <Ionicons name="arrow-up" size={13} color={colors.cyan} />
                    <Text style={styles.qaUpvoteCount}>{item.upvoteCount}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  setupScroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  setupContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    top: 16,
  },
  setupTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 20,
  },
  coverPicker: {
    width: 110,
    height: 146,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 6,
  },
  coverPreviewWrap: {
    alignItems: 'center',
    gap: 6,
  },
  coverChangeLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  titleInput: {
    width: '100%',
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  sectionLabel: {
    alignSelf: 'flex-start',
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  chipsRow: {
    width: '100%',
    marginBottom: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: colors.text,
  },
  toggleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  goLiveButton: {
    backgroundColor: colors.pink,
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 16,
  },
  goLiveButtonDisabled: {
    opacity: 0.5,
  },
  goLiveLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  permissionNotice: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionLink: {
    color: colors.primary,
    fontWeight: '700',
  },
  broadcastContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cameraPlaceholder: {
    backgroundColor: colors.surfaceAlt,
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
  liveBadge: {
    backgroundColor: colors.pink,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveBadgeLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
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
  flipButton: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    padding: 6,
  },
  endButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  endButtonLabel: {
    color: colors.text,
    fontSize: 13,
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
  rightActions: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 22,
  },
  actionItem: {
    alignItems: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.pink,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeDotLabel: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '800',
  },
  guestsScrollContent: {
    paddingBottom: 16,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  guestName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  guestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  removeGuestLabel: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
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
    maxHeight: '75%',
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
  modalBody: {
    padding: 16,
    gap: 10,
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
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalPrimaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  modalPrimaryLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  modalSecondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 6,
  },
  modalSecondaryLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  activePollQuestion: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  pollResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pollResultLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  pollResultPct: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pollOptionInput: {
    flex: 1,
  },
  addOptionButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  addOptionLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  qaList: {
    padding: 16,
    flexGrow: 1,
  },
  leaderboardEmpty: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
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
  qaRowHighlighted: {
    borderColor: colors.cyan,
    backgroundColor: 'rgba(79,216,255,0.08)',
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
