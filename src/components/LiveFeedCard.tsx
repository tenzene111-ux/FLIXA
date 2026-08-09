import React from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import type { LiveStream } from '../types/liveStream';

const { width } = Dimensions.get('window');

type Props = {
  stream: LiveStream;
  height: number;
  onPress: () => void;
};

// The LIVE entry card that can appear inside the For You feed — same full-
// bleed footprint as a VideoCard so it pages identically, but never gates
// behind following the host (spec: "Do not force the user to follow the
// creator first").
export default function LiveFeedCard({ stream, height, onPress }: Props) {
  return (
    <Pressable style={[styles.card, { width, height }]} onPress={onPress}>
      {stream.coverUrl ? (
        <Image source={{ uri: stream.coverUrl }} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallbackBg]} />
      )}
      <View style={styles.scrim} pointerEvents="none" />

      <View style={styles.liveBadge} pointerEvents="none">
        <View style={styles.liveDot} />
        <Text style={styles.liveBadgeLabel}>LIVE</Text>
      </View>

      <View style={styles.centerPlay} pointerEvents="none">
        <Ionicons name="play-circle" size={68} color="rgba(255,255,255,0.85)" />
      </View>

      <View style={styles.info} pointerEvents="none">
        <Text style={styles.hostName}>@{stream.hostUsername}</Text>
        <View style={styles.watchingRow}>
          <Ionicons name="eye" size={14} color={colors.text} />
          <Text style={styles.watchingLabel}>{formatCount(stream.viewerCount)} watching</Text>
        </View>
        {stream.title ? (
          <Text style={styles.title} numberOfLines={2}>
            {stream.title}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    justifyContent: 'flex-end',
  },
  fallbackBg: {
    backgroundColor: colors.surfaceAlt,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,3,15,0.35)',
  },
  liveBadge: {
    position: 'absolute',
    top: 110,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.pink,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text,
  },
  liveBadgeLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  centerPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    padding: 20,
    paddingBottom: 40,
    gap: 6,
  },
  hostName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  watchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  watchingLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 4,
  },
});
