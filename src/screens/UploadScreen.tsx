import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { createPost } from '../services/posts';
import { getDraft, saveDraft } from '../services/drafts';
import CameraCapture from '../components/CameraCapture';
import OverlayLayer from '../components/OverlayLayer';
import TrimControls from '../components/TrimControls';
import { getErrorMessage } from '../utils/errors';
import { logEvent } from '../services/analytics';
import type { MainTabParamList } from '../navigation/MainTabNavigator';
import type { VideoOverlay } from '../types/post';
import type { Poll } from '../types/poll';

type Selection = {
  videoUri: string;
  thumbnailUri: string;
};

const STICKERS = ['🔥', '❤️', '😂', '😍', '🎉', '👏', '✨', '💯'];

export default function UploadScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const route = useRoute<RouteProp<MainTabParamList, 'Upload'>>();
  const { user } = useAuth();

  const [showCamera, setShowCamera] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState<number | null>(null);
  const [overlays, setOverlays] = useState<VideoOverlay[]>([]);
  const [musicTitle, setMusicTitle] = useState('');
  const [poll, setPoll] = useState<Poll | null>(null);
  const [pollDraft, setPollDraft] = useState<{ question: string; options: string[] } | null>(null);
  const [activePanel, setActivePanel] = useState<'trim' | 'sticker' | null>(null);
  const [textPrompt, setTextPrompt] = useState<{ purpose: 'text' | 'music'; value: string } | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  const player = useVideoPlayer(selection?.videoUri ?? null, (p) => {
    p.loop = true;
    p.play();
  });

  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });

  const effectiveTrimEnd = trimEnd ?? player.duration ?? 0;

  useEffect(() => {
    if (trimEnd === null && player.duration > 0) {
      setTrimEnd(player.duration);
    }
  }, [player.duration, trimEnd]);

  useEffect(() => {
    if (!selection) return;
    if (currentTime < trimStart || currentTime >= effectiveTrimEnd) {
      player.currentTime = trimStart;
    }
  }, [currentTime]);

  useEffect(() => {
    if (!user || !route.params?.draftId) return;
    getDraft(user.uid, route.params.draftId).then((draft) => {
      if (!draft) return;
      setSelection({ videoUri: draft.videoUri, thumbnailUri: draft.thumbnailUri });
      setCaption(draft.caption);
      setTrimStart(draft.trimStart);
      setTrimEnd(draft.trimEnd);
      setOverlays(draft.overlays);
      setMusicTitle(draft.musicTitle);
      setPoll(draft.poll);
    });
  }, [user, route.params?.draftId]);

  const buildSelection = async (videoUri: string) => {
    try {
      const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 0 });
      setSelection({ videoUri, thumbnailUri });
      setTrimStart(0);
      setTrimEnd(null);
      setOverlays([]);
      setMusicTitle('');
      setPoll(null);
    } catch (error) {
      const message = getErrorMessage(error, 'Please try a different clip.');
      Alert.alert("Couldn't process that video", message);
    }
  };

  const handleCameraCaptured = (videoUri: string) => {
    setShowCamera(false);
    buildSelection(videoUri);
  };

  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo library permission needed', 'Enable photo library access in Settings to pick a video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
    });
    if (!result.canceled && result.assets[0]) {
      await buildSelection(result.assets[0].uri);
    }
  };

  const handleDiscard = () => {
    player.pause();
    setSelection(null);
    setCaption('');
    setOverlays([]);
    setMusicTitle('');
    setPoll(null);
  };

  const handleAddSticker = (emoji: string) => {
    setOverlays((prev) => [...prev, { id: String(Date.now()), kind: 'sticker', content: emoji, x: 0.5, y: 0.5 }]);
    setActivePanel(null);
  };

  const handleTextPromptSubmit = () => {
    if (!textPrompt) return;
    const value = textPrompt.value.trim();
    if (textPrompt.purpose === 'music') {
      setMusicTitle(value);
    } else if (value) {
      setOverlays((prev) => [...prev, { id: String(Date.now()), kind: 'text', content: value, x: 0.5, y: 0.4 }]);
    }
    setTextPrompt(null);
  };

  const handlePollOptionChange = (index: number, value: string) => {
    setPollDraft((prev) => {
      if (!prev) return prev;
      const options = [...prev.options];
      options[index] = value;
      return { ...prev, options };
    });
  };

  const handleAddPollOption = () => {
    setPollDraft((prev) => (prev && prev.options.length < 4 ? { ...prev, options: [...prev.options, ''] } : prev));
  };

  const handleRemovePollOption = (index: number) => {
    setPollDraft((prev) => (prev && prev.options.length > 2 ? { ...prev, options: prev.options.filter((_, i) => i !== index) } : prev));
  };

  const handleSavePoll = () => {
    if (!pollDraft) return;
    const question = pollDraft.question.trim();
    const options = pollDraft.options.map((text) => text.trim()).filter(Boolean);
    if (!question || options.length < 2) {
      Alert.alert('Poll needs a question and at least 2 options');
      return;
    }
    setPoll({ question, options: options.map((text, index) => ({ id: `opt-${index}`, text })) });
    setPollDraft(null);
  };

  const handleRemovePoll = () => {
    setPoll(null);
    setPollDraft(null);
  };

  const handleSaveDraft = async () => {
    if (!selection || !user) return;
    setSavingDraft(true);
    try {
      await saveDraft(user.uid, {
        videoUri: selection.videoUri,
        thumbnailUri: selection.thumbnailUri,
        caption,
        trimStart,
        trimEnd,
        overlays,
        musicTitle,
        poll,
      });
      Alert.alert('Saved', 'Your video was saved to Drafts.');
      handleDiscard();
    } catch (error) {
      const message = getErrorMessage(error, 'Please try again.');
      Alert.alert("Couldn't save draft", message);
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePost = async () => {
    if (!selection || !user) return;
    setUploading(true);
    setProgress(0);
    try {
      await createPost({
        uid: user.uid,
        caption: caption.trim(),
        videoUri: selection.videoUri,
        thumbnailUri: selection.thumbnailUri,
        trimStart,
        trimEnd,
        overlays,
        musicTitle: musicTitle.trim(),
        poll,
        onProgress: setProgress,
      });
      setSelection(null);
      setCaption('');
      setOverlays([]);
      setMusicTitle('');
      setPoll(null);
      logEvent('post_created', user.uid);
      navigation.navigate('Home');
    } catch (error) {
      const message = getErrorMessage(error, 'Please check your connection and try again.');
      Alert.alert('Upload failed', message);
    } finally {
      setUploading(false);
    }
  };

  if (showCamera) {
    return <CameraCapture onCaptured={handleCameraCaptured} onClose={() => setShowCamera(false)} />;
  }

  if (!selection) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="videocam-outline" size={56} color={colors.textMuted} />
        <Text style={styles.title}>Create a video</Text>
        <Text style={styles.subtitle}>Record something new or upload from your gallery</Text>

        <TouchableOpacity onPress={() => setShowCamera(true)} activeOpacity={0.85} style={styles.primaryButtonWrap}>
          <LinearGradient
            colors={colors.gradientButton}
            style={styles.primaryButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="videocam" size={20} color={colors.text} />
            <Text style={styles.primaryButtonLabel}>Record</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={handlePickFromGallery} activeOpacity={0.85} style={styles.secondaryButton}>
          <Ionicons name="images-outline" size={20} color={colors.text} />
          <Text style={styles.secondaryButtonLabel}>Choose from Gallery</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.preview}>
        <VideoView player={player} style={styles.previewVideo} contentFit="cover" nativeControls={false} />
        <OverlayLayer overlays={overlays} editable onChange={setOverlays} />

        <TouchableOpacity style={[styles.closeButton, { top: insets.top + 8 }]} onPress={handleDiscard}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={[styles.editToolbar, { top: insets.top + 8 }]}>
          <EditToolButton icon="cut-outline" label="Trim" onPress={() => setActivePanel('trim')} />
          <EditToolButton icon="text-outline" label="Text" onPress={() => setTextPrompt({ purpose: 'text', value: '' })} />
          <EditToolButton icon="happy-outline" label="Sticker" onPress={() => setActivePanel('sticker')} />
          <EditToolButton
            icon="musical-notes-outline"
            label="Music"
            onPress={() => setTextPrompt({ purpose: 'music', value: musicTitle })}
          />
          <EditToolButton
            icon="stats-chart-outline"
            label="Poll"
            onPress={() =>
              setPollDraft({ question: poll?.question ?? '', options: poll ? poll.options.map((o) => o.text) : ['', ''] })
            }
          />
          <EditToolButton icon="bookmark-outline" label="Draft" onPress={handleSaveDraft} disabled={savingDraft} />
        </View>

        {poll ? (
          <TouchableOpacity
            style={[styles.musicPill, styles.pollPill]}
            onPress={() => setPollDraft({ question: poll.question, options: poll.options.map((o) => o.text) })}
          >
            <Ionicons name="stats-chart" size={13} color={colors.text} />
            <Text style={styles.musicPillLabel} numberOfLines={1}>
              {poll.question}
            </Text>
          </TouchableOpacity>
        ) : null}

        {musicTitle ? (
          <View style={styles.musicPill}>
            <Ionicons name="musical-notes" size={13} color={colors.text} />
            <Text style={styles.musicPillLabel} numberOfLines={1}>
              {musicTitle}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.captionBar, { paddingBottom: insets.bottom + 16 }]}>
        <TextInput
          style={styles.captionInput}
          placeholder="Write a caption..."
          placeholderTextColor={colors.textDim}
          value={caption}
          onChangeText={setCaption}
          multiline
          editable={!uploading}
        />

        <TouchableOpacity onPress={handlePost} disabled={uploading} activeOpacity={0.85}>
          <LinearGradient
            colors={colors.gradientButton}
            style={[styles.postButton, uploading && styles.postButtonDisabled]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {uploading ? (
              <>
                <ActivityIndicator color={colors.text} size="small" />
                <Text style={styles.postButtonLabel}>{Math.round(progress * 100)}%</Text>
              </>
            ) : (
              <Text style={styles.postButtonLabel}>Post</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <Modal visible={activePanel === 'trim'} transparent animationType="slide" onRequestClose={() => setActivePanel(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trim</Text>
              <TouchableOpacity onPress={() => setActivePanel(null)} hitSlop={8}>
                <Text style={styles.modalDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <TrimControls
              duration={player.duration ?? 0}
              trimStart={trimStart}
              trimEnd={effectiveTrimEnd}
              onChange={(nextStart, nextEnd) => {
                setTrimStart(nextStart);
                setTrimEnd(nextEnd);
              }}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={activePanel === 'sticker'} transparent animationType="slide" onRequestClose={() => setActivePanel(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Stickers</Text>
              <TouchableOpacity onPress={() => setActivePanel(null)} hitSlop={8}>
                <Text style={styles.modalDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal contentContainerStyle={styles.stickerRow}>
              {STICKERS.map((emoji) => (
                <TouchableOpacity key={emoji} onPress={() => handleAddSticker(emoji)} style={styles.stickerButton}>
                  <Text style={styles.stickerEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!pollDraft} transparent animationType="slide" onRequestClose={() => setPollDraft(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Poll</Text>
              <TouchableOpacity onPress={() => setPollDraft(null)} hitSlop={8}>
                <Text style={styles.modalDone}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pollForm}>
              <TextInput
                style={styles.promptInput}
                placeholder="Ask a question..."
                placeholderTextColor={colors.textDim}
                value={pollDraft?.question ?? ''}
                onChangeText={(value) => setPollDraft((prev) => (prev ? { ...prev, question: value } : prev))}
              />
              {pollDraft?.options.map((option, index) => (
                <View key={index} style={styles.pollOptionRow}>
                  <TextInput
                    style={[styles.promptInput, styles.pollOptionInput]}
                    placeholder={`Option ${index + 1}`}
                    placeholderTextColor={colors.textDim}
                    value={option}
                    onChangeText={(value) => handlePollOptionChange(index, value)}
                  />
                  {pollDraft.options.length > 2 ? (
                    <TouchableOpacity onPress={() => handleRemovePollOption(index)} hitSlop={8}>
                      <Ionicons name="close-circle" size={20} color={colors.textDim} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              {(pollDraft?.options.length ?? 0) < 4 ? (
                <TouchableOpacity onPress={handleAddPollOption} style={styles.addOptionButton}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={styles.addOptionLabel}>Add option</Text>
                </TouchableOpacity>
              ) : null}
              <View style={styles.promptActions}>
                {poll ? (
                  <TouchableOpacity onPress={handleRemovePoll} style={styles.promptButton}>
                    <Text style={[styles.promptButtonLabel, styles.removePollLabel]}>Remove poll</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={handleSavePoll} style={styles.promptButton}>
                  <Text style={[styles.promptButtonLabel, styles.promptButtonPrimary]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!textPrompt} transparent animationType="fade" onRequestClose={() => setTextPrompt(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.promptSheet}>
            <Text style={styles.modalTitle}>{textPrompt?.purpose === 'music' ? 'Add music info' : 'Add text'}</Text>
            <TextInput
              style={styles.promptInput}
              placeholder={textPrompt?.purpose === 'music' ? 'Song - Artist' : 'Type something...'}
              placeholderTextColor={colors.textDim}
              value={textPrompt?.value ?? ''}
              onChangeText={(value) => setTextPrompt((prev) => (prev ? { ...prev, value } : prev))}
              autoFocus
            />
            <View style={styles.promptActions}>
              <TouchableOpacity onPress={() => setTextPrompt(null)} style={styles.promptButton}>
                <Text style={styles.promptButtonLabel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleTextPromptSubmit} style={styles.promptButton}>
                <Text style={[styles.promptButtonLabel, styles.promptButtonPrimary]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function EditToolButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.editToolButton} onPress={onPress} disabled={disabled} hitSlop={6}>
      <Ionicons name={icon} size={18} color={colors.text} />
      <Text style={styles.editToolLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  primaryButtonWrap: {
    width: '100%',
    marginBottom: 14,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
  },
  primaryButtonLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    width: '100%',
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  preview: {
    flex: 1,
  },
  previewVideo: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editToolbar: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 16,
  },
  editToolButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  editToolLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '600',
  },
  musicPill: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
    maxWidth: '70%',
  },
  musicPillLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  pollPill: {
    bottom: 56,
  },
  captionBar: {
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  captionInput: {
    color: colors.text,
    fontSize: 14,
    maxHeight: 80,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 24,
    gap: 8,
  },
  postButtonDisabled: {
    opacity: 0.7,
  },
  postButtonLabel: {
    color: colors.text,
    fontSize: 15,
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
    paddingBottom: 24,
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
  stickerRow: {
    padding: 16,
    gap: 14,
  },
  stickerButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerEmoji: {
    fontSize: 26,
  },
  promptSheet: {
    marginHorizontal: 24,
    marginBottom: 'auto',
    marginTop: 'auto',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  promptInput: {
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  promptActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
  },
  promptButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  promptButtonLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  promptButtonPrimary: {
    color: colors.primary,
  },
  pollForm: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  addOptionLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  removePollLabel: {
    color: colors.danger,
  },
});
