import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

type Props = {
  raised: number;
  target: number;
};

export default function LiveGoalBar({ raised, target }: Props) {
  const pct = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Ionicons name="flag" size={12} color={colors.cyan} />
        <Text style={styles.label}>
          {raised} / {target} diamonds
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.cyan,
  },
});
