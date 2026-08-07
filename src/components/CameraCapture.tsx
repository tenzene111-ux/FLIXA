import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

const DURATIONS = [15, 60] as const;

type Props = {
  onCaptured: (videoUri: string) => void;
  onClose: () => void;
};

export default function CameraCapture({ onCaptured, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [maxDuration, setMaxDuration] = useState<(typeof DURATIONS)[number]>(15);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!cameraPermission?.granted) requestCameraPermission();
    if (!micPermission?.granted) requestMicPermission();
  }, []);

  useEffect(() => {
    if (!recording) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [recording]);

  const handleRecordPress = async () => {
    if (recording) {
      cameraRef.current?.stopRecording();
      return;
    }
    setRecording(true);
    try {
      const video = await cameraRef.current?.recordAsync({ maxDuration });
      if (video?.uri) onCaptured(video.uri);
    } finally {
      setRecording(false);
    }
  };

  if (!cameraPermission || !micPermission) {
    return <View style={styles.container} />;
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <View style={[styles.container, styles.permissionContainer]}>
        <Ionicons name="videocam-outline" size={48} color={colors.textMuted} />
        <Text style={styles.permissionTitle}>Camera & microphone access needed</Text>
        <Text style={styles.permissionSubtitle}>Enable access in Settings to record a video</Text>
        <TouchableOpacity style={styles.closeLink} onPress={onClose}>
          <Text style={styles.closeLinkLabel}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mode="video" />

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconButton} onPress={onClose}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        {!recording && (
          <TouchableOpacity style={styles.iconButton} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}>
            <Ionicons name="camera-reverse-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {recording && (
        <View style={[styles.timerBadge, { top: insets.top + 8 }]}>
          <View style={styles.recordingDot} />
          <Text style={styles.timerLabel}>
            {elapsed}s / {maxDuration}s
          </Text>
        </View>
      )}

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
        {!recording && (
          <View style={styles.durationRow}>
            {DURATIONS.map((option) => (
              <TouchableOpacity key={option} onPress={() => setMaxDuration(option)} style={styles.durationItem}>
                <View style={[styles.durationPill, maxDuration === option && styles.durationPillActive]}>
                  <Text style={[styles.durationLabel, maxDuration === option && styles.durationLabelActive]}>
                    {option}s
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.recordButtonOuter} onPress={handleRecordPress} activeOpacity={0.85}>
          <View style={[styles.recordButtonInner, recording && styles.recordButtonInnerActive]} />
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
  permissionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  permissionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  permissionSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  closeLink: {
    marginTop: 16,
  },
  closeLinkLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBadge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  timerLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  durationRow: {
    flexDirection: 'row',
    marginBottom: 18,
    gap: 8,
  },
  durationItem: {},
  durationPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    backgroundColor: colors.danger,
  },
  recordButtonInnerActive: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
});
