import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';
import FlixaLogo from '../components/FlixaLogo';

const { width, height } = Dimensions.get('window');

type Props = {
  onAnimationDone?: () => void;
};

// Plays once on cold start (see RootNavigator): logo fade+scale -> glow
// pulse -> wordmark -> tagline -> hold -> onAnimationDone. The ambient
// wave background keeps drifting the whole time this screen is mounted,
// independent of the intro sequence, so if auth is still resolving after
// the ~1.3s intro finishes the screen doesn't go static or blank.
export default function LaunchScreen({ onAnimationDone }: Props) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.85)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const waveLeft = useRef(new Animated.Value(0)).current;
  const waveRight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveLeft, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(waveLeft, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveRight, { toValue: 1, duration: 5000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(waveRight, { toValue: 0, duration: 5000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1.15, duration: 220, useNativeDriver: true }),
      ]),
      Animated.timing(glowScale, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(wordmarkOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(500),
    ]).start(() => onAnimationDone?.());
  }, []);

  const waveLeftTranslate = waveLeft.interpolate({ inputRange: [0, 1], outputRange: [-30, 10] });
  const waveRightTranslate = waveRight.interpolate({ inputRange: [0, 1], outputRange: [30, -10] });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.waveLeft, { transform: [{ translateX: waveLeftTranslate }] }]}>
        <LinearGradient
          colors={['rgba(255,10,108,0.32)', 'rgba(255,10,108,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      <Animated.View style={[styles.waveRight, { transform: [{ translateX: waveRightTranslate }] }]}>
        <LinearGradient
          colors={['rgba(24,215,232,0)', 'rgba(24,215,232,0.32)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Animated.View style={[styles.glowOuter, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
          <Animated.View style={[styles.glowInner, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
          <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
            <FlixaLogo size={96} />
          </Animated.View>
        </View>

        <Animated.View style={{ opacity: wordmarkOpacity, marginTop: 22 }}>
          <View style={styles.wordmarkRow}>
            <Text style={styles.wordmark}>FLI</Text>
            <Text style={[styles.wordmark, styles.wordmarkAccent]}>X</Text>
            <Text style={styles.wordmark}>A</Text>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: taglineOpacity, marginTop: 10 }}>
          <Text style={styles.tagline}>
            <Text style={{ color: colors.pink }}>WATCH</Text>
            <Text style={styles.taglineDot}> . </Text>
            <Text style={{ color: colors.purple }}>CREATE</Text>
            <Text style={styles.taglineDot}> . </Text>
            <Text style={{ color: colors.cyan }}>CONNECT</Text>
            <Text style={styles.taglineDot}>.</Text>
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  waveLeft: {
    position: 'absolute',
    left: -width * 0.25,
    top: 0,
    width: width * 0.85,
    height,
  },
  waveRight: {
    position: 'absolute',
    right: -width * 0.25,
    top: 0,
    width: width * 0.85,
    height,
  },
  center: {
    alignItems: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.magenta,
    opacity: 0,
  },
  glowInner: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.purple,
    opacity: 0,
  },
  wordmarkRow: {
    flexDirection: 'row',
  },
  wordmark: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 4,
  },
  wordmarkAccent: {
    color: colors.cyan,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
  },
  taglineDot: {
    color: colors.textMuted,
  },
});
