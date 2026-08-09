import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import colors from '../theme/colors';
import TrimControls from '../components/TrimControls';
import { getErrorMessage } from '../utils/errors';
import { uploadRawClip, uploadRawPhoto, createVideoJob, subscribeToVideoJob } from '../services/videoProcessing';
import { createPostFromProcessedVideo } from '../services/posts';
import type { CommentsSetting, PostPrivacy } from '../types/post';
import {
  DEFAULT_COLOR_ADJUSTMENTS,
  DEFAULT_JOB_AUDIO,
  VIDEO_TRANSITIONS,
  defaultClipEdit,
  defaultImageClipEdit,
  type ClipKind,
  type ColorAdjustments,
  type CropAspect,
  type EditorInputClip,
  type VideoClipEdit,
  type VideoEditDecisionList,
  type VideoJob,
  type VideoTransition,
} from '../types/videoEdit';

const CLIP_SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 4] as const;
const IMAGE_DURATION_OPTIONS = [1, 1.5, 2, 2.5, 3, 4, 5, 6] as const;
const CROP_OPTIONS: { value: CropAspect; label: string }[] = [
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '4:5', label: '4:5' },
  { value: 'original', label: 'Original' },
];
const TRANSITION_LABELS: Record<VideoTransition, string> = {
  none: 'None',
  fade: 'Fade',
  zoom: 'Zoom',
  slide: 'Slide',
  swipe: 'Swipe',
  blur: 'Blur',
  flash: 'Flash',
  spin: 'Spin',
  morph: 'Morph',
};
const FILTER_PRESETS: { id: string; label: string; color: ColorAdjustments }[] = [
  { id: 'none', label: 'None', color: DEFAULT_COLOR_ADJUSTMENTS },
  { id: 'warm', label: 'Warm', color: { ...DEFAULT_COLOR_ADJUSTMENTS, temperature: 0.5 } },
  { id: 'cinematic', label: 'Cinematic', color: { ...DEFAULT_COLOR_ADJUSTMENTS, contrast: 0.2, saturation: -0.1, vignette: 0.4 } },
  { id: 'vintage', label: 'Vintage', color: { ...DEFAULT_COLOR_ADJUSTMENTS, saturation: -0.3, grain: 0.3, vignette: 0.3, temperature: 0.2 } },
  { id: 'bw', label: 'B&W', color: { ...DEFAULT_COLOR_ADJUSTMENTS, saturation: -1 } },
  { id: 'hdr', label: 'HDR', color: { ...DEFAULT_COLOR_ADJUSTMENTS, contrast: 0.3, brightness: 0.05 } },
  { id: 'night', label: 'Night', color: { ...DEFAULT_COLOR_ADJUSTMENTS, brightness: 0.2, contrast: 0.1, temperature: -0.3 } },
  { id: 'film', label: 'Film', color: { ...DEFAULT_COLOR_ADJUSTMENTS, grain: 0.25, vignette: 0.25, contrast: 0.1 } },
  { id: 'portrait', label: 'Portrait', color: { ...DEFAULT_COLOR_ADJUSTMENTS, vignette: 0.3, temperature: 0.15 } },
];
const PRIVACY_OPTIONS: { value: PostPrivacy; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'followers', label: 'Followers' },
  { value: 'friends', label: 'Friends' },
  { value: 'onlyMe', label: 'Only me' },
];
const COMMENTS_OPTIONS: { value: CommentsSetting; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'followers', label: 'Followers' },
  { value: 'friends', label: 'Friends' },
  { value: 'nobody', label: 'Nobody' },
];

type EditableClip = {
  id: string;
  localUri: string;
  kind: ClipKind;
  approxDurationSec: number;
  edit: VideoClipEdit;
  thumbUri: string | null;
};

type Stage = 'edit' | 'uploading' | 'processing' | 'error';
type ToolTab = 'clip' | 'adjust' | 'cover';

type Props = {
  uid: string;
  clips: EditorInputClip[];
  initialCropAspect?: CropAspect;
  initialColor?: ColorAdjustments;
  onCancel: () => void;
  onPublished: () => void;
};

export default function VideoEditorScreen({ uid, clips, initialCropAspect, initialColor, onCancel, onPublished }: Props) {
  const insets = useSafeAreaInsets();

  const [editableClips, setEditableClips] = useState<EditableClip[]>(() =>
    clips.map((c, i) => {
      const kind: ClipKind = c.kind ?? 'video';
      return {
        id: `clip-${i}-${Date.now()}`,
        localUri: c.uri,
        kind,
        approxDurationSec: c.durationSec,
        edit:
          kind === 'image'
            ? { ...defaultImageClipEdit('', c.durationSec, c.transitionToNext ?? 'fade'), kenBurns: c.kenBurns ?? true }
            : { ...defaultClipEdit(''), speed: c.speed, transitionToNext: c.transitionToNext ?? 'none' },
        thumbUri: null,
      };
    })
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<ToolTab>('clip');

  const [rotationDeg, setRotationDeg] = useState<0 | 90 | 180 | 270>(0);
  const [cropAspect, setCropAspect] = useState<CropAspect>(initialCropAspect ?? '9:16');
  const [color, setColor] = useState<ColorAdjustments>(initialColor ?? DEFAULT_COLOR_ADJUSTMENTS);
  const [activeFilterId, setActiveFilterId] = useState('none');

  const [coverFrameOptions, setCoverFrameOptions] = useState<string[]>([]);
  const [coverUri, setCoverUri] = useState<string | null>(null);

  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState<PostPrivacy>('everyone');
  const [commentsSetting, setCommentsSetting] = useState<CommentsSetting>('everyone');
  const [allowDownloads, setAllowDownloads] = useState(true);

  const [stage, setStage] = useState<Stage>('edit');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [job, setJob] = useState<VideoJob | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const selectedClip = editableClips[selectedIndex] ?? editableClips[0] ?? null;
  const playerSource = selectedClip && selectedClip.kind !== 'image' ? selectedClip.localUri : null;
  const player = useVideoPlayer(playerSource, (p) => {
    p.loop = true;
    p.play();
  });

  const clipIdsKey = editableClips.map((c) => c.id).join(',');
  useEffect(() => {
    editableClips.forEach((c) => {
      if (c.thumbUri) return;
      if (c.kind === 'image') {
        setEditableClips((prev) => prev.map((p) => (p.id === c.id ? { ...p, thumbUri: c.localUri } : p)));
        return;
      }
      VideoThumbnails.getThumbnailAsync(c.localUri, { time: 0 })
        .then(({ uri }) => setEditableClips((prev) => prev.map((p) => (p.id === c.id ? { ...p, thumbUri: uri } : p))))
        .catch(() => {});
    });
  }, [clipIdsKey]);

  const firstClipUri = editableClips[0]?.localUri;
  const firstClipKind = editableClips[0]?.kind;
  useEffect(() => {
    const first = editableClips[0];
    if (!first) return;
    if (first.kind === 'image') {
      setCoverFrameOptions([first.localUri]);
      return;
    }
    const dur = Math.max(1, first.approxDurationSec);
    const offsets = [0, dur * 0.33, dur * 0.66, Math.max(0, dur - 0.5)];
    Promise.all(
      offsets.map((t) =>
        VideoThumbnails.getThumbnailAsync(first.localUri, { time: Math.round(t * 1000) })
          .then((r) => r.uri)
          .catch(() => null)
      )
    ).then((uris) => setCoverFrameOptions(uris.filter((u): u is string => !!u)));
  }, [firstClipUri, firstClipKind]);

  const effectiveCoverUri = coverUri ?? editableClips[0]?.thumbUri ?? coverFrameOptions[0] ?? null;

  const totalDurationSec = useMemo(
    () => editableClips.reduce((sum, c) => sum + c.approxDurationSec / (c.edit.speed || 1), 0),
    [editableClips]
  );

  function updateSelectedClipEdit(patch: Partial<VideoClipEdit>) {
    setEditableClips((prev) => prev.map((c, i) => (i === selectedIndex ? { ...c, edit: { ...c.edit, ...patch } } : c)));
  }

  function handleDeleteClip(index: number) {
    if (editableClips.length <= 1) {
      Alert.alert("Can't remove the last clip", 'Add another clip before deleting this one.');
      return;
    }
    setEditableClips((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndex((prev) => Math.max(0, Math.min(prev, editableClips.length - 2)));
  }

  function handleMoveClip(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= editableClips.length) return;
    setEditableClips((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSelectedIndex(target);
  }

  function applyFilterPreset(preset: (typeof FILTER_PRESETS)[number]) {
    setActiveFilterId(preset.id);
    setColor(preset.color);
  }

  async function handlePickCoverImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo library permission needed', 'Enable photo library access in Settings to pick a cover image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri);
    }
  }

  async function handlePost() {
    if (editableClips.length === 0 || !effectiveCoverUri) return;
    setStage('uploading');
    setUploadProgress(0);
    setErrorMessage('');
    try {
      const storagePaths: string[] = [];
      for (let i = 0; i < editableClips.length; i++) {
        const clip = editableClips[i];
        const onProgress = (pct: number) => setUploadProgress((i + pct) / editableClips.length);
        const path = clip.kind === 'image' ? await uploadRawPhoto(uid, clip.localUri, onProgress) : await uploadRawClip(uid, clip.localUri, onProgress);
        storagePaths.push(path);
      }

      const edl: VideoEditDecisionList = {
        clips: editableClips.map((c, i) => ({ ...c.edit, storagePath: storagePaths[i] })),
        rotationDeg,
        cropAspect,
        color,
        audio: DEFAULT_JOB_AUDIO,
      };
      const jobId = await createVideoJob(uid, edl);
      setStage('processing');

      const unsubscribe = subscribeToVideoJob(jobId, async (nextJob) => {
        if (!nextJob) return;
        setJob(nextJob);
        if (nextJob.status === 'complete' && nextJob.outputUrl) {
          unsubscribe();
          try {
            await createPostFromProcessedVideo({
              uid,
              caption: caption.trim(),
              videoUrl: nextJob.outputUrl,
              thumbnailUri: effectiveCoverUri,
              privacy,
              commentsSetting,
              allowDownloads,
            });
            onPublished();
          } catch (error) {
            setErrorMessage(getErrorMessage(error, 'Please try again.'));
            setStage('error');
          }
        } else if (nextJob.status === 'failed') {
          unsubscribe();
          setErrorMessage(nextJob.error || 'Processing failed.');
          setStage('error');
        }
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Please check your connection and try again.'));
      setStage('error');
    }
  }

  const busy = stage === 'uploading' || stage === 'processing';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onCancel} hitSlop={8} disabled={busy}>
          <Ionicons name="close" size={26} color={busy ? colors.textDim : colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit ({editableClips.length} clip{editableClips.length === 1 ? '' : 's'})</Text>
        <Text style={styles.headerDuration}>{Math.round(totalDurationSec)}s</Text>
      </View>

      <View style={styles.preview}>
        {selectedClip?.kind === 'image' ? (
          <Image source={{ uri: selectedClip.localUri }} style={styles.previewVideo} resizeMode="contain" />
        ) : (
          <VideoView player={player} style={styles.previewVideo} contentFit="contain" nativeControls={false} />
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timelineRow} contentContainerStyle={styles.timelineContent}>
        {editableClips.map((clip, index) => (
          <TouchableOpacity
            key={clip.id}
            style={[styles.clipThumb, selectedIndex === index && styles.clipThumbActive]}
            onPress={() => setSelectedIndex(index)}
          >
            <View style={styles.clipThumbInner}>
              {clip.thumbUri ? (
                <ThumbImage uri={clip.thumbUri} />
              ) : (
                <ActivityIndicator size="small" color={colors.textMuted} />
              )}
            </View>
            <Text style={styles.clipThumbLabel}>{index + 1}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.tabBar}>
        {(['clip', 'adjust', 'cover'] as ToolTab[]).map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabButtonLabel, activeTab === tab && styles.tabButtonLabelActive]}>
              {tab === 'clip' ? 'Clip' : tab === 'adjust' ? 'Adjust' : 'Cover'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: insets.bottom + 220 }}>
        {activeTab === 'clip' && selectedClip && (
          <View style={styles.panel}>
            <View style={styles.clipToolRow}>
              <TouchableOpacity style={styles.clipToolButton} onPress={() => handleMoveClip(selectedIndex, -1)} disabled={selectedIndex === 0}>
                <Ionicons name="chevron-back" size={18} color={selectedIndex === 0 ? colors.textDim : colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.clipToolButton} onPress={() => handleMoveClip(selectedIndex, 1)} disabled={selectedIndex === editableClips.length - 1}>
                <Ionicons name="chevron-forward" size={18} color={selectedIndex === editableClips.length - 1 ? colors.textDim : colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.clipToolButton, styles.clipToolButtonDanger]}
                onPress={() => handleDeleteClip(selectedIndex)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={[styles.clipToolLabel, { color: colors.danger }]}>Delete clip</Text>
              </TouchableOpacity>
            </View>

            {selectedClip.kind === 'image' ? (
              <>
                <Text style={styles.panelLabel}>Duration</Text>
                <View style={styles.chipRow}>
                  {IMAGE_DURATION_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.chip, selectedClip.edit.durationSec === option && styles.chipActive]}
                      onPress={() => updateSelectedClipEdit({ durationSec: option, trimEndSec: option })}
                    >
                      <Text style={[styles.chipLabel, selectedClip.edit.durationSec === option && styles.chipLabelActive]}>{option}s</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.reverseRow}>
                  <Text style={styles.panelLabel}>Ken Burns zoom</Text>
                  <Switch
                    value={!!selectedClip.edit.kenBurns}
                    onValueChange={(value) => updateSelectedClipEdit({ kenBurns: value })}
                    trackColor={{ true: colors.primary, false: colors.border }}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.panelLabel}>Trim</Text>
                <TrimControls
                  duration={selectedClip.approxDurationSec}
                  trimStart={selectedClip.edit.trimStartSec}
                  trimEnd={selectedClip.edit.trimEndSec ?? selectedClip.approxDurationSec}
                  onChange={(start, end) => updateSelectedClipEdit({ trimStartSec: start, trimEndSec: end })}
                />

                <Text style={styles.panelLabel}>Speed</Text>
                <View style={styles.chipRow}>
                  {CLIP_SPEED_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.chip, selectedClip.edit.speed === option && styles.chipActive]}
                      onPress={() => updateSelectedClipEdit({ speed: option })}
                    >
                      <Text style={[styles.chipLabel, selectedClip.edit.speed === option && styles.chipLabelActive]}>{option}x</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.reverseRow}>
                  <Text style={styles.panelLabel}>Reverse</Text>
                  <Switch
                    value={selectedClip.edit.reversed}
                    onValueChange={(value) => updateSelectedClipEdit({ reversed: value })}
                    trackColor={{ true: colors.primary, false: colors.border }}
                  />
                </View>
              </>
            )}

            {selectedIndex < editableClips.length - 1 && (
              <>
                <Text style={styles.panelLabel}>Transition to next clip</Text>
                <View style={styles.chipRow}>
                  {VIDEO_TRANSITIONS.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.chip, selectedClip.edit.transitionToNext === t && styles.chipActive]}
                      onPress={() => updateSelectedClipEdit({ transitionToNext: t })}
                    >
                      <Text style={[styles.chipLabel, selectedClip.edit.transitionToNext === t && styles.chipLabelActive]}>
                        {TRANSITION_LABELS[t]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {activeTab === 'adjust' && (
          <View style={styles.panel}>
            <Text style={styles.panelLabel}>Crop</Text>
            <View style={styles.chipRow}>
              {CROP_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, cropAspect === option.value && styles.chipActive]}
                  onPress={() => setCropAspect(option.value)}
                >
                  <Text style={[styles.chipLabel, cropAspect === option.value && styles.chipLabelActive]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.rotateRow}>
              <Text style={styles.panelLabel}>Rotate</Text>
              <TouchableOpacity
                style={styles.rotateButton}
                onPress={() => setRotationDeg((prev) => (((prev + 90) % 360) as 0 | 90 | 180 | 270))}
              >
                <Ionicons name="reload-outline" size={16} color={colors.text} />
                <Text style={styles.rotateButtonLabel}>{rotationDeg}°</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.panelLabel}>Filters</Text>
            <View style={styles.chipRow}>
              {FILTER_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={[styles.chip, activeFilterId === preset.id && styles.chipActive]}
                  onPress={() => applyFilterPreset(preset)}
                >
                  <Text style={[styles.chipLabel, activeFilterId === preset.id && styles.chipLabelActive]}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterHint}>Filters and color adjustments are applied when your video is processed.</Text>

            <ColorSlider label="Brightness" value={color.brightness} min={-1} max={1} onChange={(v) => { setActiveFilterId('none'); setColor((c) => ({ ...c, brightness: v })); }} />
            <ColorSlider label="Contrast" value={color.contrast} min={-1} max={1} onChange={(v) => { setActiveFilterId('none'); setColor((c) => ({ ...c, contrast: v })); }} />
            <ColorSlider label="Saturation" value={color.saturation} min={-1} max={1} onChange={(v) => { setActiveFilterId('none'); setColor((c) => ({ ...c, saturation: v })); }} />
            <ColorSlider label="Temperature" value={color.temperature} min={-1} max={1} onChange={(v) => { setActiveFilterId('none'); setColor((c) => ({ ...c, temperature: v })); }} />
            <ColorSlider label="Vignette" value={color.vignette} min={0} max={1} onChange={(v) => { setActiveFilterId('none'); setColor((c) => ({ ...c, vignette: v })); }} />
            <ColorSlider label="Grain" value={color.grain} min={0} max={1} onChange={(v) => { setActiveFilterId('none'); setColor((c) => ({ ...c, grain: v })); }} />
          </View>
        )}

        {activeTab === 'cover' && (
          <View style={styles.panel}>
            <Text style={styles.panelLabel}>Select frame</Text>
            <View style={styles.coverRow}>
              {coverFrameOptions.map((uri, i) => (
                <TouchableOpacity key={i} onPress={() => setCoverUri(uri)} style={[styles.coverFrame, effectiveCoverUri === uri && styles.coverFrameActive]}>
                  <ThumbImage uri={uri} />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.uploadCoverButton} onPress={handlePickCoverImage}>
              <Ionicons name="image-outline" size={16} color={colors.text} />
              <Text style={styles.uploadCoverLabel}>Upload custom cover</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.panel}>
          <Text style={styles.panelLabel}>Caption</Text>
          <TextInput
            style={styles.captionInput}
            placeholder="Write a caption... #hashtags @mentions"
            placeholderTextColor={colors.textDim}
            value={caption}
            onChangeText={setCaption}
            multiline
          />

          <Text style={styles.panelLabel}>Who can watch?</Text>
          <View style={styles.chipRow}>
            {PRIVACY_OPTIONS.map((option) => (
              <TouchableOpacity key={option.value} style={[styles.chip, privacy === option.value && styles.chipActive]} onPress={() => setPrivacy(option.value)}>
                <Text style={[styles.chipLabel, privacy === option.value && styles.chipLabelActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.panelLabel}>Who can comment?</Text>
          <View style={styles.chipRow}>
            {COMMENTS_OPTIONS.map((option) => (
              <TouchableOpacity key={option.value} style={[styles.chip, commentsSetting === option.value && styles.chipActive]} onPress={() => setCommentsSetting(option.value)}>
                <Text style={[styles.chipLabel, commentsSetting === option.value && styles.chipLabelActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.reverseRow}>
            <Text style={styles.panelLabel}>Allow downloads</Text>
            <Switch value={allowDownloads} onValueChange={setAllowDownloads} trackColor={{ true: colors.primary, false: colors.border }} />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity onPress={handlePost} disabled={busy || !effectiveCoverUri} activeOpacity={0.85}>
          <LinearGradient colors={colors.gradientButton} style={[styles.postButton, busy && styles.postButtonDisabled]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {stage === 'uploading' ? (
              <>
                <ActivityIndicator color={colors.text} size="small" />
                <Text style={styles.postButtonLabel}>Uploading {Math.round(uploadProgress * 100)}%</Text>
              </>
            ) : stage === 'processing' ? (
              <>
                <ActivityIndicator color={colors.text} size="small" />
                <Text style={styles.postButtonLabel}>Processing{job?.status === 'processing' ? '…' : ''}</Text>
              </>
            ) : (
              <Text style={styles.postButtonLabel}>Post</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {stage === 'error' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity onPress={() => setStage('edit')}>
              <Text style={styles.errorRetry}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function ThumbImage({ uri }: { uri: string }) {
  return <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />;
}

function ColorSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{value.toFixed(2)}</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  headerDuration: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  preview: {
    height: 260,
    backgroundColor: '#000',
  },
  previewVideo: {
    flex: 1,
  },
  timelineRow: {
    flexGrow: 0,
    marginTop: 8,
  },
  timelineContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  clipThumb: {
    width: 52,
    height: 68,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: 8,
    alignItems: 'center',
  },
  clipThumbActive: {
    borderColor: colors.primary,
  },
  clipThumbInner: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  clipThumbLabel: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    textShadowColor: '#000',
    textShadowRadius: 2,
  },
  tabBar: {
    flexDirection: 'row',
    marginTop: 10,
    marginHorizontal: 16,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabButtonLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  tabButtonLabelActive: {
    color: colors.text,
  },
  scrollBody: {
    flex: 1,
    marginTop: 8,
  },
  panel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 4,
  },
  panelLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 8,
  },
  clipToolRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  clipToolButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipToolButtonDanger: {
    flexDirection: 'row',
    width: 'auto',
    paddingHorizontal: 12,
    gap: 6,
  },
  clipToolLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: colors.text,
  },
  reverseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rotateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rotateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rotateButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  filterHint: {
    color: colors.textDim,
    fontSize: 11,
    marginBottom: 8,
  },
  sliderBlock: {
    marginBottom: 4,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  sliderValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  slider: {
    width: '100%',
    height: 28,
  },
  coverRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  coverFrame: {
    width: 60,
    height: 78,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceAlt,
  },
  coverFrameActive: {
    borderColor: colors.primary,
  },
  uploadCoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  uploadCoverLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  captionInput: {
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
    opacity: 0.85,
  },
  postButtonLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  errorBox: {
    marginTop: 10,
    alignItems: 'center',
    gap: 4,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    textAlign: 'center',
  },
  errorRetry: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
