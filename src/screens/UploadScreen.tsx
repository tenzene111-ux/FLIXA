import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import colors from '../theme/colors';
import { TAB_BAR_HEIGHT } from '../theme/layout';
import { useAuth } from '../context/AuthContext';
import { createVideoPost, uploadVideoFile } from '../services/videos';

const TOOLS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'camera-reverse-outline', label: 'Flip' },
  { icon: 'speedometer-outline', label: 'Speed' },
  { icon: 'sparkles-outline', label: 'Beauty' },
  { icon: 'color-filter-outline', label: 'Filters' },
  { icon: 'timer-outline', label: 'Timer' },
  { icon: 'color-wand-outline', label: 'Retouch' },
];

const DURATIONS = ['10m', '60s', '15s', 'Photo', 'Text'] as const;
const DURATION_SECONDS: Partial<Record<(typeof DURATIONS)[number], number>> = {
  '10m': 600,
  '60s': 60,
  '15s': 15,
};

export default function UploadScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>('15s');
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  const postVideo = async (localUri: string) => {
    if (!user) return;
    setPosting(true);
    try {
      const videoUrl = await uploadVideoFile(user.uid, localUri);
      const handle = user.email ? `@${user.email.split('@')[0]}` : '@you';
      await createVideoPost({
        uploaderId: user.uid,
        username: handle,
        userAvatar: `https://i.pravatar.cc/150?u=${user.uid}`,
        videoUrl,
        caption: caption.trim() || 'New video',
        song: 'Original Sound',
      });
      setCaption('');
      navigation.navigate('Home' as never);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPosting(false);
    }
  };

  const handleCapture = async () => {
    if (!user) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Enable camera permission in Settings to record a video.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: DURATION_SECONDS[duration] ?? 60,
    });
    if (!result.canceled && result.assets[0]) {
      await postVideo(result.assets[0].uri);
    }
  };

  const handlePickFromGallery = async () => {
    if (!user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo library access needed', 'Enable photo library permission in Settings to upload a video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'] });
    if (!result.canceled && result.assets[0]) {
      await postVideo(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.navigate('Home' as never)}>
          <BlurView intensity={35} tint="dark" style={styles.iconButton}>
            <Ionicons name="close" size={26} color={colors.text} />
          </BlurView>
        </TouchableOpacity>

        <View style={styles.toolStack}>
          {TOOLS.map((tool) => (
            <TouchableOpacity key={tool.label}>
              <BlurView intensity={35} tint="dark" style={styles.toolButton}>
                <Ionicons name={tool.icon} size={22} color={colors.text} />
              </BlurView>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <LinearGradient
        colors={colors.gradient}
        style={styles.addSoundRing}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <TouchableOpacity>
          <BlurView intensity={50} tint="dark" style={styles.addSoundPill}>
            <Ionicons name="musical-notes" size={14} color={colors.text} />
            <Text style={styles.addSoundLabel}>Add Sound</Text>
          </BlurView>
        </TouchableOpacity>
      </LinearGradient>

      <LinearGradient
        colors={['#2A1145', '#0A0A18', '#0F1A3A']}
        style={styles.previewHint}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      >
        {posting ? (
          <>
            <ActivityIndicator color={colors.text} size="large" />
            <Text style={styles.previewHintText}>Uploading your video…</Text>
          </>
        ) : (
          <>
            <MaterialCommunityIcons name="video-outline" size={48} color={colors.textMuted} />
            <Text style={styles.previewHintText}>Tap record, or pick a video from your library</Text>
          </>
        )}
      </LinearGradient>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16 }]}>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Add a caption..."
          placeholderTextColor={colors.textDim}
          style={styles.captionInput}
          editable={!posting}
        />

        <View style={styles.durationRow}>
          {DURATIONS.map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => setDuration(option)}
              style={styles.durationItem}
              disabled={posting}
            >
              <View style={[styles.durationPill, duration === option && styles.durationPillActive]}>
                <Text style={[styles.durationLabel, duration === option && styles.durationLabelActive]}>
                  {option}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.sideButton} disabled={posting}>
            <LinearGradient
              colors={colors.gradient}
              style={styles.sideButtonChip}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="color-palette-outline" size={20} color={colors.text} />
            </LinearGradient>
            <Text style={styles.sideButtonLabel}>Effects</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.recordButtonOuter}
            activeOpacity={0.85}
            onPress={handleCapture}
            disabled={posting}
          >
            <LinearGradient
              colors={colors.gradientButton}
              style={styles.recordButtonInner}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.sideButton} onPress={handlePickFromGallery} disabled={posting}>
            <BlurView intensity={35} tint="dark" style={styles.sideButtonChipDark}>
              <Ionicons name="images-outline" size={20} color={colors.text} />
            </BlurView>
            <Text style={styles.sideButtonLabel}>Upload</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolStack: {
    alignItems: 'center',
    gap: 20,
  },
  toolButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSoundRing: {
    position: 'absolute',
    top: 108,
    alignSelf: 'center',
    borderRadius: 21,
    padding: 1.5,
    zIndex: 3,
  },
  addSoundPill: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  addSoundLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  previewHint: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  previewHintText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  bottomBar: {
    paddingTop: 12,
  },
  captionInput: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 22,
  },
  durationItem: {
    marginHorizontal: 4,
  },
  durationPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  durationPillActive: {
    backgroundColor: colors.surfaceLight,
  },
  durationLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  durationLabelActive: {
    color: colors.textOnLight,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  sideButton: {
    alignItems: 'center',
    gap: 6,
    width: 56,
  },
  sideButtonChip: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideButtonChipDark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideButtonLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  recordButtonOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.glowPink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 10,
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
});
