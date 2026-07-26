import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';

const TOOLS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'camera-reverse-outline', label: 'Flip' },
  { icon: 'speedometer-outline', label: 'Speed' },
  { icon: 'sparkles-outline', label: 'Beauty' },
  { icon: 'color-filter-outline', label: 'Filters' },
  { icon: 'timer-outline', label: 'Timer' },
];

const DURATIONS = ['10m', '60s', '15s', 'Photo', 'Text'] as const;

export default function UploadScreen() {
  const insets = useSafeAreaInsets();
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>('15s');

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.toolStack}>
          {TOOLS.map((tool) => (
            <TouchableOpacity key={tool.label} style={styles.toolButton}>
              <Ionicons name={tool.icon} size={22} color={colors.text} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.addSoundPill}>
        <Ionicons name="musical-notes" size={14} color={colors.text} />
        <Text style={styles.addSoundLabel}>Add Sound</Text>
      </TouchableOpacity>

      <View style={styles.previewHint}>
        <MaterialCommunityIcons name="video-outline" size={48} color={colors.textDim} />
        <Text style={styles.previewHintText}>Camera preview goes here</Text>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.durationRow}>
          {DURATIONS.map((option) => (
            <TouchableOpacity key={option} onPress={() => setDuration(option)} style={styles.durationItem}>
              <View style={[styles.durationPill, duration === option && styles.durationPillActive]}>
                <Text style={[styles.durationLabel, duration === option && styles.durationLabelActive]}>
                  {option}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.sideButton}>
            <Ionicons name="color-palette-outline" size={26} color={colors.text} />
            <Text style={styles.sideButtonLabel}>Effects</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.recordButtonOuter} activeOpacity={0.85}>
            <LinearGradient
              colors={colors.gradientButton}
              style={styles.recordButtonInner}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.sideButton}>
            <Ionicons name="images-outline" size={26} color={colors.text} />
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolStack: {
    alignItems: 'center',
    gap: 20,
  },
  toolButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSoundPill: {
    position: 'absolute',
    top: 108,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
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
  },
  previewHintText: {
    color: colors.textDim,
    fontSize: 13,
  },
  bottomBar: {
    paddingTop: 12,
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
    backgroundColor: colors.surfaceAlt,
  },
  durationLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  durationLabelActive: {
    color: colors.text,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  sideButton: {
    alignItems: 'center',
    gap: 4,
    width: 56,
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
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
});
