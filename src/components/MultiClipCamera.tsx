import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

export type RecordedClip = {
  uri: string;
  durationSec: number;
  // Capture-time speed choice. expo-camera has no native slow/fast-motion
  // capture control, so this is a playback-rate proxy: it just pre-fills
  // this clip's edit-time speed in the editor rather than truly changing
  // how fast frames were captured.
  speed: number;
};

const TIMER_OPTIONS = [0, 3, 5, 10] as const;
const SPEED_OPTIONS = [0.3, 0.5, 1, 2, 3] as const;
const ZOOM_STEPS = [0, 0.25, 0.5, 1] as const;
const ZOOM_LABELS = ['1x', '2x', '3x', '5x'];
const MAX_TOTAL_DURATION_SEC = 180;
const HOLD_THRESHOLD_MS = 350;

type Props = {
  onDone: (clips: RecordedClip[]) => void;
  onClose: () => void;
};

export default function MultiClipCamera({ onDone, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [torch, setTorch] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [timerSec, setTimerSec] = useState<(typeof TIMER_OPTIONS)[number]>(0);
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1);
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);

  const [clips, setClips] = useState<RecordedClip[]>([]);
  const [recording, setRecording] = useState(false);
  const [isHoldMode, setIsHoldMode] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingPromiseRef = useRef<Promise<{ uri: string } | undefined> | null>(null);

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

  const totalRecordedSec = clips.reduce((sum, c) => sum + c.durationSec, 0);
  const remainingBudgetSec = Math.max(1, MAX_TOTAL_DURATION_SEC - totalRecordedSec);

  const startClip = async () => {
    if (recording || remainingBudgetSec <= 1) return;
    setRecording(true);
    const startedAt = Date.now();
    const promise = cameraRef.current?.recordAsync({ maxDuration: remainingBudgetSec });
    recordingPromiseRef.current = promise ?? null;
    const video = await promise;
    setRecording(false);
    setIsHoldMode(false);
    if (video?.uri) {
      const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      setClips((prev) => [...prev, { uri: video.uri, durationSec, speed }]);
    }
  };

  const stopClip = () => {
    cameraRef.current?.stopRecording();
  };

  const runCountdownThenRecord = () => {
    if (timerSec === 0) {
      startClip();
      return;
    }
    setCountdown(timerSec);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      startClip();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handlePressIn = () => {
    if (countdown !== null) return;
    if (recording) {
      // Second tap while a tap-started clip is still rolling: stop it.
      stopClip();
      return;
    }
    setIsHoldMode(false);
    holdTimerRef.current = setTimeout(() => setIsHoldMode(true), HOLD_THRESHOLD_MS);
    runCountdownThenRecord();
  };

  const handlePressOut = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHoldMode) {
      stopClip();
    }
    // Otherwise this was a quick tap: keep recording until the next tap.
  };

  const handleDeleteLastClip = () => {
    setClips((prev) => prev.slice(0, -1));
  };

  const handleDone = () => {
    if (clips.length === 0) return;
    onDone(clips);
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
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
        enableTorch={torch && facing === 'back'}
        zoom={ZOOM_STEPS[zoomIndex]}
      />

      {countdown !== null && (
        <View style={styles.countdownOverlay} pointerEvents="none">
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      )}

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconButton} onPress={onClose}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.topBarRight}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setTorch((v) => !v)}>
            <Ionicons name={torch ? 'flash' : 'flash-off'} size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setTimerSec((prev) => TIMER_OPTIONS[(TIMER_OPTIONS.indexOf(prev) + 1) % TIMER_OPTIONS.length])}
          >
            <Ionicons name="timer-outline" size={22} color={colors.text} />
            {timerSec > 0 && <Text style={styles.timerBadgeLabel}>{timerSec}</Text>}
          </TouchableOpacity>
          {!recording && (
            <TouchableOpacity style={styles.iconButton} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}>
              <Ionicons name="camera-reverse-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {recording && (
        <View style={[styles.recordingBadge, { top: insets.top + 56 }]}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingLabel}>{elapsed}s</Text>
        </View>
      )}

      {clips.length > 0 && (
        <View style={styles.clipStrip}>
          {clips.map((clip, i) => (
            <View key={i} style={styles.clipChip}>
              <Text style={styles.clipChipLabel}>
                {i + 1} · {clip.durationSec}s
              </Text>
            </View>
          ))}
          <Text style={styles.clipTotalLabel}>{totalRecordedSec}s total</Text>
        </View>
      )}

      <View style={styles.zoomRail}>
        {ZOOM_LABELS.map((label, i) => (
          <TouchableOpacity key={label} onPress={() => setZoomIndex(i)} style={styles.zoomStop}>
            <Text style={[styles.zoomStopLabel, zoomIndex === i && styles.zoomStopLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        {!recording && (
          <View style={styles.toolRow}>
            <TouchableOpacity style={styles.toolButton} onPress={() => setShowSpeedPicker((v) => !v)}>
              <Text style={styles.toolButtonLabel}>{speed}x Speed</Text>
            </TouchableOpacity>
          </View>
        )}

        {showSpeedPicker && !recording && (
          <View style={styles.speedRow}>
            {SPEED_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => {
                  setSpeed(option);
                  setShowSpeedPicker(false);
                }}
                style={styles.speedPill}
              >
                <Text style={[styles.speedPillLabel, speed === option && styles.speedPillLabelActive]}>{option}x</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.recordRow}>
          <View style={styles.recordRowSide}>
            {clips.length > 0 && !recording && (
              <TouchableOpacity onPress={handleDeleteLastClip} style={styles.sideAction}>
                <Ionicons name="trash-outline" size={22} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.85}
            style={styles.recordButtonOuter}
          >
            <View style={[styles.recordButtonInner, recording && styles.recordButtonInnerActive]} />
          </TouchableOpacity>

          <View style={styles.recordRowSide}>
            {clips.length > 0 && !recording && (
              <TouchableOpacity onPress={handleDone} style={styles.sideAction}>
                <Ionicons name="checkmark-circle" size={40} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.hintLabel}>Tap to start/stop · Hold to record</Text>
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
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  countdownText: {
    color: colors.text,
    fontSize: 96,
    fontWeight: '800',
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topBarRight: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBadgeLabel: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: colors.background,
    borderRadius: 6,
    paddingHorizontal: 3,
  },
  recordingBadge: {
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
  recordingLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  clipStrip: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 100,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  clipChip: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clipChipLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  clipTotalLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  zoomRail: {
    position: 'absolute',
    right: 12,
    top: '38%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    paddingVertical: 6,
    gap: 10,
  },
  zoomStop: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  zoomStopLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  zoomStopLabelActive: {
    color: colors.text,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
  },
  toolRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toolButton: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  toolButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  speedRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    padding: 6,
  },
  speedPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  speedPillLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  speedPillLabelActive: {
    color: colors.primary,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  recordRowSide: {
    width: 64,
    alignItems: 'center',
  },
  sideAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  hintLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
  },
});
