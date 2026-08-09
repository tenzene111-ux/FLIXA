import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import colors from '../theme/colors';
import VideoEditorScreen from './VideoEditorScreen';
import { DEFAULT_COLOR_ADJUSTMENTS, type ColorAdjustments, type CropAspect, type EditorInputClip, type VideoTransition } from '../types/videoEdit';

type Template = {
  id: string;
  label: string;
  description: string;
  slotDurationSec: number;
  transition: VideoTransition;
  kenBurns: boolean;
  cropAspect: CropAspect;
  color: ColorAdjustments;
};

const TEMPLATES: Template[] = [
  {
    id: 'classic',
    label: 'Classic Slideshow',
    description: 'Gentle fades, slow zoom',
    slotDurationSec: 2.5,
    transition: 'fade',
    kenBurns: true,
    cropAspect: '9:16',
    color: DEFAULT_COLOR_ADJUSTMENTS,
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Zoom transitions, moody grade',
    slotDurationSec: 3,
    transition: 'zoom',
    kenBurns: true,
    cropAspect: '9:16',
    color: { ...DEFAULT_COLOR_ADJUSTMENTS, contrast: 0.2, saturation: -0.1, vignette: 0.4 },
  },
  {
    id: 'vintage',
    label: 'Vintage Memories',
    description: 'Warm grain, soft blur cuts',
    slotDurationSec: 2.5,
    transition: 'blur',
    kenBurns: true,
    cropAspect: '9:16',
    color: { ...DEFAULT_COLOR_ADJUSTMENTS, saturation: -0.3, grain: 0.3, vignette: 0.3, temperature: 0.2 },
  },
  {
    id: 'fastcuts',
    label: 'Fast Cuts',
    description: 'Snappy flash cuts, no zoom',
    slotDurationSec: 1.2,
    transition: 'flash',
    kenBurns: false,
    cropAspect: '9:16',
    color: DEFAULT_COLOR_ADJUSTMENTS,
  },
  {
    id: 'travel',
    label: 'Travel Story',
    description: 'Warm tones, slide transitions',
    slotDurationSec: 3,
    transition: 'slide',
    kenBurns: true,
    cropAspect: '9:16',
    color: { ...DEFAULT_COLOR_ADJUSTMENTS, temperature: 0.5 },
  },
];

const MIN_PHOTOS = 2;
const MAX_PHOTOS = 9;

type Props = {
  uid: string;
  onCancel: () => void;
  onPublished: () => void;
};

export default function PhotoModeScreen({ uid, onCancel, onPublished }: Props) {
  const insets = useSafeAreaInsets();
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [photos, setPhotos] = useState<string[]>([]);
  const [editorClips, setEditorClips] = useState<EditorInputClip[] | null>(null);

  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];

  const handlePickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo library permission needed', 'Enable photo library access in Settings to pick photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotos(result.assets.slice(0, MAX_PHOTOS).map((a) => a.uri));
    }
  };

  const handleRemovePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p !== uri));
  };

  const handleContinue = () => {
    if (photos.length < MIN_PHOTOS) return;
    setEditorClips(
      photos.map((uri) => ({
        uri,
        durationSec: template.slotDurationSec,
        speed: 1,
        kind: 'image',
        kenBurns: template.kenBurns,
        transitionToNext: template.transition,
      }))
    );
  };

  if (editorClips) {
    return (
      <VideoEditorScreen
        uid={uid}
        clips={editorClips}
        initialCropAspect={template.cropAspect}
        initialColor={template.color}
        onCancel={() => setEditorClips(null)}
        onPublished={onPublished}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onCancel} hitSlop={8}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Photo Mode & Templates</Text>
        <View style={{ width: 26 }} />
      </View>

      <Text style={styles.sectionLabel}>Template</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
        {TEMPLATES.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.templateCard, templateId === t.id && styles.templateCardActive]}
            onPress={() => setTemplateId(t.id)}
          >
            <Text style={[styles.templateLabel, templateId === t.id && styles.templateLabelActive]}>{t.label}</Text>
            <Text style={styles.templateDescription}>{t.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>
        Photos ({photos.length}/{MAX_PHOTOS})
      </Text>
      <ScrollView contentContainerStyle={styles.photoGrid}>
        {photos.map((uri) => (
          <View key={uri} style={styles.photoCell}>
            <Image source={{ uri }} style={styles.photoImage} />
            <TouchableOpacity style={styles.photoRemove} onPress={() => handleRemovePhoto(uri)}>
              <Ionicons name="close-circle" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addPhotoCell} onPress={handlePickPhotos}>
          <Ionicons name="add" size={28} color={colors.textMuted} />
          <Text style={styles.addPhotoLabel}>Add photos</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.footerHint}>
          {photos.length < MIN_PHOTOS ? `Pick at least ${MIN_PHOTOS} photos to continue` : `${photos.length} photos · ${template.label}`}
        </Text>
        <TouchableOpacity onPress={handleContinue} disabled={photos.length < MIN_PHOTOS} activeOpacity={0.85}>
          <LinearGradient
            colors={colors.gradientButton}
            style={[styles.continueButton, photos.length < MIN_PHOTOS && styles.continueButtonDisabled]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.continueButtonLabel}>Continue to Edit</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 12,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  templateRow: {
    paddingHorizontal: 16,
    gap: 10,
  },
  templateCard: {
    width: 150,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginRight: 10,
    backgroundColor: colors.surfaceAlt,
  },
  templateCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  templateLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  templateLabelActive: {
    color: colors.primary,
  },
  templateDescription: {
    color: colors.textMuted,
    fontSize: 11,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 140,
  },
  photoCell: {
    width: 96,
    height: 96,
    borderRadius: 10,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  addPhotoCell: {
    width: 96,
    height: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
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
    gap: 8,
  },
  footerHint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  continueButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 24,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
