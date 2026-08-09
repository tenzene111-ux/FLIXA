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

// Royal/Mythical gifts (Golden Dragon, Druk Universe, Sky Dragon, etc.) get
// an extra "epic" pass layered on top of the base animation below — an
// expanding energy ring and a flicker of lightning bolts once the gift
// card has landed, plus a slower-drifting ember layer alongside the
// sparkle particles. Gated by tier, not gift id, so it stays generic
// across all of them rather than special-casing the dragon gifts by name.
const EPIC_TIER = 4;
const LIGHTNING_ANGLES = [-70, -35, -8, 22, 55, 82];

function emberCountForTier(tier: number) {
  return tier >= 5 ? 16 : tier >= EPIC_TIER ? 10 : 0;
}

// One reusable, tier-scaled animation rather than 25 bespoke ones: a
// gradient glow (using the gift's own color stops) with its emoji,
// radiating sparkle particles (more of them at higher tiers), and an
// increasingly dark full-screen dim for tier 3+ so the highest tiers read
// as a real takeover moment. Driven by whichever gift doc a
// subscribeToLatestGift listener saw arrive — see VideoCard/
// LiveViewerScreen/LiveHostScreen — so every viewer sees it, not just
// the sender. Deliberately stays a flat overlay layer rather than a real
// depth-composited AR effect (occluding behind/in front of the host) —
// that would need real-time person segmentation, a native ML dependency
// this project doesn't have.
export default function GiftAnimationOverlay({ event, onDone }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;
  const dimOpacity = useRef(new Animated.Value(0)).current;
  const particleAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const boltFlicker = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!event) return;

    opacity.setValue(0);
    scale.setValue(0.6);
    dimOpacity.setValue(0);
    particleAnim.setValue(0);
    ringAnim.setValue(0);
    boltFlicker.setValue(0);

    const isEpic = event.gift.tier >= EPIC_TIER;
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
    ]).start(() => {
      if (!isEpic) return;
      // The energy-ring pulse + lightning flicker land once the card has
      // finished forming, not simultaneously with it — reads as the gift
      // "charging up" rather than everything firing at once.
      Animated.timing(ringAnim, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      Animated.sequence([
        Animated.timing(boltFlicker, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(boltFlicker, { toValue: 0.2, duration: 90, useNativeDriver: true }),
        Animated.timing(boltFlicker, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(boltFlicker, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    });

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

  // Embers drift up and slightly outward rather than radiating evenly like
  // the sparkles above — a second, slower-moving depth layer so the epic
  // gifts don't just look like "more of the same particle".
  const embers = useMemo(() => {
    if (!event) return [];
    const count = emberCountForTier(event.gift.tier);
    return Array.from({ length: count }, (_, i) => {
      const spread = (i / Math.max(count - 1, 1) - 0.5) * 220;
      const rise = 140 + (i % 4) * 30;
      return { key: i, dx: spread, dy: -rise, delay: (i % 5) * 60 };
    });
  }, [event?.id]);

  if (!event) return null;
  const { gift, fromUsername } = event;
  const isEpic = gift.tier >= EPIC_TIER;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFillObject, styles.dim, { opacity: dimOpacity }]} />

      {isEpic ? (
        <Animated.View
          style={[
            styles.ring,
            { borderColor: gift.colors[0] },
            {
              opacity: ringAnim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.8, 0] }),
              transform: [{ scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.4] }) }],
            },
          ]}
        />
      ) : null}

      {isEpic
        ? LIGHTNING_ANGLES.map((deg, i) => (
            <Animated.View
              key={deg}
              style={[
                styles.bolt,
                {
                  backgroundColor: gift.colors[gift.colors.length - 1],
                  opacity: boltFlicker,
                  transform: [{ rotate: `${deg}deg` }, { translateY: -30 - (i % 2) * 12 }],
                },
              ]}
            />
          ))
        : null}

      {embers.map((p) => (
        <Animated.View
          key={`ember-${p.key}`}
          style={[
            styles.ember,
            { backgroundColor: gift.colors[0] },
            {
              opacity: particleAnim.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: particleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                { translateY: particleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
              ],
            },
          ]}
        />
      ))}

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
  ring: {
    position: 'absolute',
    top: '46%',
    left: '50%',
    marginLeft: -60,
    marginTop: -60,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
  },
  bolt: {
    position: 'absolute',
    top: '46%',
    left: '50%',
    marginLeft: -1.5,
    width: 3,
    height: 70,
    borderRadius: 2,
  },
  ember: {
    position: 'absolute',
    top: '46%',
    left: '50%',
    width: 6,
    height: 6,
    borderRadius: 3,
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
