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

// Mythical (tier 5) gifts get a full staged sequence on top of the epic
// pass above — smoke/silhouette emerging, a head-rise with glowing eyes
// and opening wings, a roar (flash + lightning + camera shake), a lunge
// with a particle burst, then a dissolve back into smoke. This is a 2D
// layered-graphics staging of that beat structure (gradients, particles,
// simple shapes, Animated transforms) — not a rendered 3D character. A
// real rigged/animated 3D dragon (Blender model + skeleton + Unity
// integration) is a genuinely different, much larger project — this
// project is React Native/Expo, not Unity, and has no 3D pipeline.
const CINEMATIC_TIER = 5;
const REFERENCE_SEQUENCE_MS = 8000;

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

  // Cinematic (tier 5) staging values
  const smokeIn = useRef(new Animated.Value(0)).current;
  const eyeGlow = useRef(new Animated.Value(0)).current;
  const wingOpen = useRef(new Animated.Value(0)).current;
  const roarFlash = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const lungeScale = useRef(new Animated.Value(1)).current;
  const burstAnim = useRef(new Animated.Value(0)).current;
  const dissolveOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!event) return;

    const isEpic = event.gift.tier >= EPIC_TIER;
    const isCinematic = event.gift.tier >= CINEMATIC_TIER;

    opacity.setValue(0);
    scale.setValue(0.6);
    dimOpacity.setValue(0);
    particleAnim.setValue(0);
    ringAnim.setValue(0);
    boltFlicker.setValue(0);
    smokeIn.setValue(0);
    eyeGlow.setValue(0);
    wingOpen.setValue(0);
    roarFlash.setValue(0);
    shakeX.setValue(0);
    lungeScale.setValue(1);
    burstAnim.setValue(0);
    dissolveOut.setValue(1);

    if (isCinematic) {
      // Scale the 8-second reference storyboard to fit comfortably inside
      // this gift's own configured duration, leaving room for the fade-out.
      const seqMs = Math.min(event.gift.durationSec * 1000 - 1500, REFERENCE_SEQUENCE_MS);
      const s = Math.max(0.5, seqMs / REFERENCE_SEQUENCE_MS);

      Animated.sequence([
        // Stage 1 (0–1s): smoke rolls in, silhouette emerges
        Animated.parallel([
          Animated.timing(dimOpacity, { toValue: 0.55, duration: 1000 * s, useNativeDriver: true }),
          Animated.timing(smokeIn, { toValue: 1, duration: 1000 * s, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 900 * s, useNativeDriver: true }),
        ]),
        // Stage 2 (1–2.5s): head rises, eyes glow, wings open
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.08, duration: 1500 * s, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(eyeGlow, { toValue: 1, duration: 1500 * s, useNativeDriver: true }),
          Animated.timing(wingOpen, { toValue: 1, duration: 1500 * s, easing: Easing.out(Easing.back(1.15)), useNativeDriver: true }),
        ]),
        // Stage 3 (2.5–4s): mouth opens, body moves forward
        Animated.timing(scale, { toValue: 1.18, duration: 1500 * s, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        // Stage 4 (4–5s): ROAR — flash, lightning, camera shake
        Animated.parallel([
          Animated.sequence([
            Animated.timing(roarFlash, { toValue: 1, duration: 90 * s, useNativeDriver: true }),
            Animated.timing(roarFlash, { toValue: 0, duration: 500 * s, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(boltFlicker, { toValue: 1, duration: 60 * s, useNativeDriver: true }),
            Animated.timing(boltFlicker, { toValue: 0.2, duration: 70 * s, useNativeDriver: true }),
            Animated.timing(boltFlicker, { toValue: 1, duration: 50 * s, useNativeDriver: true }),
            Animated.timing(boltFlicker, { toValue: 0, duration: 400 * s, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(shakeX, { toValue: 8, duration: 40 * s, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: -8, duration: 40 * s, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: 6, duration: 40 * s, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: -6, duration: 40 * s, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: 0, duration: 40 * s, useNativeDriver: true }),
          ]),
        ]),
        // Stage 5 (5–6.5s): lunges toward the viewer, particle explosion
        Animated.parallel([
          Animated.timing(lungeScale, { toValue: 1.5, duration: 1500 * s, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(burstAnim, { toValue: 1, duration: 1500 * s, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        // Stage 6 (6.5–8s): dissolves back into smoke
        Animated.parallel([
          Animated.timing(dissolveOut, { toValue: 0, duration: 1500 * s, useNativeDriver: true }),
          Animated.timing(smokeIn, { toValue: 0, duration: 1500 * s, useNativeDriver: true }),
        ]),
      ]).start();

      Animated.timing(particleAnim, {
        toValue: 1,
        duration: seqMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, useNativeDriver: true, friction: 6 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
        Animated.timing(dimOpacity, {
          toValue: event.gift.tier >= 3 ? 0.2 : 0,
          duration: 300,
          useNativeDriver: true,
        }),
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
    }

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

  // The stage-5 "massive particle explosion" — bigger radius, more of
  // them, only present for cinematic-tier gifts and driven by burstAnim
  // rather than particleAnim so it fires specifically during the lunge.
  const burstParticles = useMemo(() => {
    if (!event || event.gift.tier < CINEMATIC_TIER) return [];
    const count = 34;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + 0.3;
      const radius = 160 + (i % 4) * 55;
      return { key: i, dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
    });
  }, [event?.id]);

  const smokePuffs = useMemo(() => {
    if (!event || event.gift.tier < CINEMATIC_TIER) return [];
    return [
      { key: 0, x: -70, y: 20, size: 130 },
      { key: 1, x: 60, y: 40, size: 150 },
      { key: 2, x: -20, y: -30, size: 110 },
      { key: 3, x: 90, y: -10, size: 100 },
      { key: 4, x: -100, y: -20, size: 90 },
    ];
  }, [event?.id]);

  if (!event) return null;
  const { gift, fromUsername } = event;
  const isEpic = gift.tier >= EPIC_TIER;
  const isCinematic = gift.tier >= CINEMATIC_TIER;
  const accentColor = gift.colors[gift.colors.length - 1];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFillObject, styles.dim, { opacity: dimOpacity }]} />

      {isCinematic && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, styles.roarFlash, { opacity: roarFlash }]}
        />
      )}

      <Animated.View style={{ flex: 1, transform: [{ translateX: shakeX }] }} pointerEvents="none">
        {isCinematic &&
          smokePuffs.map((p) => (
            <Animated.View
              key={`smoke-${p.key}`}
              style={[
                styles.smokePuff,
                {
                  width: p.size,
                  height: p.size,
                  borderRadius: p.size / 2,
                  marginLeft: p.x - p.size / 2,
                  marginTop: p.y - p.size / 2,
                  opacity: smokeIn.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }),
                  transform: [{ scale: smokeIn.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] }) }],
                },
              ]}
            />
          ))}

        {isCinematic && (
          <>
            <Animated.View
              style={[
                styles.wing,
                styles.wingLeft,
                { backgroundColor: gift.colors[0] },
                {
                  opacity: wingOpen.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] }),
                  transform: [
                    { rotate: wingOpen.interpolate({ inputRange: [0, 1], outputRange: ['-10deg', '-48deg'] }) },
                    { scale: wingOpen.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.wing,
                styles.wingRight,
                { backgroundColor: gift.colors[0] },
                {
                  opacity: wingOpen.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] }),
                  transform: [
                    { rotate: wingOpen.interpolate({ inputRange: [0, 1], outputRange: ['10deg', '48deg'] }) },
                    { scale: wingOpen.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                  ],
                },
              ]}
            />
            <Animated.View style={[styles.eye, styles.eyeLeft, { opacity: eyeGlow, backgroundColor: accentColor }]} />
            <Animated.View style={[styles.eye, styles.eyeRight, { opacity: eyeGlow, backgroundColor: accentColor }]} />
          </>
        )}

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
                    backgroundColor: accentColor,
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

        {burstParticles.map((p) => (
          <Animated.View
            key={`burst-${p.key}`}
            style={[
              styles.burstParticle,
              { backgroundColor: accentColor },
              {
                opacity: burstAnim.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateX: burstAnim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                  { translateY: burstAnim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
                ],
              },
            ]}
          />
        ))}

        <Animated.View
          style={[
            styles.card,
            {
              opacity: Animated.multiply(opacity, dissolveOut),
              transform: [{ scale: Animated.multiply(scale, lungeScale) }],
            },
          ]}
        >
          <LinearGradient colors={gift.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.glow}>
            <Text style={styles.emoji}>{gift.emoji}</Text>
          </LinearGradient>
          <Text style={styles.label}>
            <Text style={styles.username}>{fromUsername}</Text> sent {gift.name}
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    backgroundColor: '#000',
  },
  roarFlash: {
    backgroundColor: '#fff',
  },
  smokePuff: {
    position: 'absolute',
    top: '46%',
    left: '50%',
    backgroundColor: '#141420',
  },
  wing: {
    position: 'absolute',
    top: '44%',
    width: 90,
    height: 26,
    borderRadius: 13,
  },
  wingLeft: {
    left: '50%',
    marginLeft: -104,
  },
  wingRight: {
    left: '50%',
    marginLeft: 14,
  },
  eye: {
    position: 'absolute',
    top: '42%',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eyeLeft: {
    left: '50%',
    marginLeft: -22,
  },
  eyeRight: {
    left: '50%',
    marginLeft: 14,
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
  burstParticle: {
    position: 'absolute',
    top: '46%',
    left: '50%',
    width: 5,
    height: 5,
    borderRadius: 2.5,
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
