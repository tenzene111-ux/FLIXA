import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import colors from '../theme/colors';

type Props = {
  duration: number;
  trimStart: number;
  trimEnd: number;
  onChange: (trimStart: number, trimEnd: number) => void;
};

function formatSeconds(value: number) {
  const seconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export default function TrimControls({ duration, trimStart, trimEnd, onChange }: Props) {
  const safeDuration = duration > 0 ? duration : 1;
  const minGap = Math.min(1, safeDuration / 4);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Start</Text>
        <Text style={styles.value}>{formatSeconds(trimStart)}</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={safeDuration}
        value={trimStart}
        onValueChange={(value) => onChange(Math.min(value, trimEnd - minGap), trimEnd)}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
      />

      <View style={styles.row}>
        <Text style={styles.label}>End</Text>
        <Text style={styles.value}>{formatSeconds(trimEnd)}</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={safeDuration}
        value={trimEnd}
        onValueChange={(value) => onChange(trimStart, Math.max(value, trimStart + minGap))}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  value: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  slider: {
    width: '100%',
    height: 32,
    marginBottom: 8,
  },
});
