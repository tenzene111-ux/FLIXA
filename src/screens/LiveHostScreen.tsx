import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AudioSession, isTrackReference, LiveKitRoom, useTracks, VideoTrack } from '@livekit/react-native';
import { Track } from 'livekit-client';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import {
  createLiveStream,
  endLiveStream,
  getLiveKitToken,
  sendLiveComment,
  subscribeToLiveComments,
  subscribeToViewerCount,
} from '../services/live';
import { getErrorMessage } from '../utils/errors';
import type { LiveComment } from '../types/liveStream';
import type { HomeStackParamList } from '../navigation/HomeStackNavigator';

export default function LiveHostScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const { user } = useAuth();
  const profile = useUserProfile(user?.uid);

  const [title, setTitle] = useState('');
  const [streamId, setStreamId] = useState<string | null>(null);
  const [session, setSession] = useState<{ token: string; serverUrl: string } | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    AudioSession.startAudioSession();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  const handleGoLive = async () => {
    if (!user || !profile || starting) return;
    setStarting(true);
    try {
      const id = await createLiveStream(user.uid, profile.username, title.trim() || `${profile.username}'s live`);
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
      <View style={[styles.setupContainer, { paddingTop: insets.top + 24 }]}>
        <TouchableOpacity onPress={navigation.goBack} style={styles.closeButton} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Ionicons name="radio-outline" size={56} color={colors.textMuted} />
        <Text style={styles.setupTitle}>Go Live</Text>
        <TextInput
          style={styles.titleInput}
          placeholder="Give your stream a title"
          placeholderTextColor={colors.textDim}
          value={title}
          onChangeText={setTitle}
        />
        <TouchableOpacity style={styles.goLiveButton} onPress={handleGoLive} disabled={starting} activeOpacity={0.85}>
          <Text style={styles.goLiveLabel}>{starting ? 'Starting...' : 'Go Live'}</Text>
        </TouchableOpacity>
      </View>
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
  const localTrack = tracks[0];
  const [viewerCount, setViewerCount] = useState(0);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [chatText, setChatText] = useState('');

  useEffect(() => subscribeToViewerCount(streamId, setViewerCount), [streamId]);
  useEffect(() => subscribeToLiveComments(streamId, setComments), [streamId]);

  const handleSend = () => {
    if (!user || !profile || !chatText.trim()) return;
    sendLiveComment(streamId, user.uid, profile.username, chatText).catch(() => {});
    setChatText('');
  };

  return (
    <View style={styles.broadcastContainer}>
      {localTrack && isTrackReference(localTrack) ? (
        <VideoTrack trackRef={localTrack} style={StyleSheet.absoluteFillObject} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.cameraPlaceholder]} />
      )}

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeLabel}>LIVE</Text>
        </View>
        <View style={styles.viewerBadge}>
          <Ionicons name="eye" size={14} color={colors.text} />
          <Text style={styles.viewerBadgeLabel}>{viewerCount}</Text>
        </View>
        <TouchableOpacity onPress={onEnd} style={styles.endButton}>
          <Text style={styles.endButtonLabel}>End</Text>
        </TouchableOpacity>
      </View>

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
          <TouchableOpacity onPress={handleSend} hitSlop={8}>
            <Ionicons name="send" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    marginBottom: 24,
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
    marginBottom: 24,
  },
  goLiveButton: {
    backgroundColor: colors.pink,
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  goLiveLabel: {
    color: colors.text,
    fontSize: 16,
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
  endButton: {
    marginLeft: 'auto',
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
  chatWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '45%',
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
});
