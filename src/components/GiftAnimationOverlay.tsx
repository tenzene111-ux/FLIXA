import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';
import type { GiftDefinition } from '../types/gift';

export type GiftAnimationEvent = {
  id: string;
  gift: GiftDefinition;
  fromUsername: string;
};

type Props = {
  event: GiftAnimationEvent | null;
  onDone?: () => void;
};

function particleCountForTier(tier: number) {
  if (tier >= 5) return 26;
  if (tier >= 3) return 16;
  return 8;
}

// One reusable, tier-scaled animation rather than 25 bespoke ones: a
// gradient glow (using the gift's own color stops) with its emoji,
// radiating sparkle particles (more of them at higher tiers), and an
// increasingly dark full-screen dim for tier 3+ so the highest tiers read
// as a real takeover moment. Driven by whichever gift doc a
// subscribeToLatestGift listener saw arrive — see VideoCard/
// LiveViewerScreen/LiveHostScreen — so every viewer sees it, not just
// the sender.
export default function GiftAnimationOverlay({ event, onDone }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;
  const dimOpacity = useRef(new Animated.Value(0)).current;
  const particleAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!event) return;

    opacity.setValue(0);
    scale.setValue(0.6);
    dimOpacity.setValue(0);
    particleAnim.setValue(0);

    const targetDim = event.gift.tier >= 5 ? 0.45 : event.gift.tier >= 3 ? 0.2 : 0;
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.timing(dimOpacity, { toValue: targetDim, duration: 300, useNativeDriver: true }),
      Animated.timing(particleAnim, {
        toValue: 1,
        duration: Math.min(event.gift.durationSec * 1000, 4000),
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    const holdMs = Math.max(800, event.gift.durationSec * 1000 - 500);
    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.8, duration: 400, useNativeDriver: true }),
        Animated.timing(dimOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => onDone?.());
    }, holdMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [event?.id]);

  const particles = useMemo(() => {
    if (!event) return [];
    const count = particleCountForTier(event.gift.tier);
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const radius = 90 + (i % 3) * 40;
      return { key: i, dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
    });
  }, [event?.id]);

  if (!event) return null;
  const { gift, fromUsername } = event;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFillObject, styles.dim, { opacity: dimOpacity }]} />

      {particles.map((p) => (
        <Animated.Text
          key={p.key}
          style={[
            styles.particle,
            {
              opacity: particleAnim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
              transform: [
                { translateX: particleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                { translateY: particleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
                { scale: particleAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 1, 0.6] }) },
              ],
            },
          ]}
        >
          ✨
        </Animated.Text>
      ))}

      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <LinearGradient colors={gift.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.glow}>
          <Text style={styles.emoji}>{gift.emoji}</Text>
        </LinearGradient>
        <Text style={styles.label}>
          <Text style={styles.username}>{fromUsername}</Text> sent {gift.name}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    backgroundColor: '#000',
  },
  particle: {
    position: 'absolute',
    top: '46%',
    left: '50%',
    fontSize: 20,
  },
  card: {
    position: 'absolute',
    top: '38%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  glow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emoji: {
    fontSize: 46,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  username: {
    fontWeight: '800',
  },
});
