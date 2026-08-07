import React, { useRef, useState } from 'react';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import colors from '../../theme/colors';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

const SLIDES: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; gradient: readonly [string, string] }[] = [
  {
    icon: 'play-circle',
    title: 'Welcome to Flixa',
    subtitle: 'A world of short videos, made for you.',
    gradient: ['#2B1055', '#7597DE'],
  },
  {
    icon: 'sparkles',
    title: 'Create with powerful tools',
    subtitle: 'Record, edit, and share in seconds.',
    gradient: ['#41295a', '#2F0743'],
  },
  {
    icon: 'people',
    title: 'Connect with creators',
    subtitle: 'Follow, like, and be part of the community.',
    gradient: ['#0F2027', '#2C5364'],
  },
];

export default function OnboardingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const handleSkip = () => {
    scrollRef.current?.scrollTo({ x: width * (SLIDES.length - 1), animated: true });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide, index) => (
          <LinearGradient key={index} colors={slide.gradient} style={styles.slide}>
            <Ionicons name={slide.icon} size={96} color={colors.text} style={styles.slideIcon} />
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.subtitle}>{slide.subtitle}</Text>
          </LinearGradient>
        ))}
      </ScrollView>

      <TouchableOpacity style={[styles.skip, { top: insets.top + 12 }]} onPress={handleSkip}>
        <Text style={styles.skipLabel}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, index) => (
            <View key={index} style={[styles.dot, index === page && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('SignUp')} activeOpacity={0.85}>
          <LinearGradient
            colors={colors.gradientButton}
            style={styles.primaryButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.primaryButtonLabel}>Get Started</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.secondaryButtonLabel}>Log In</Text>
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
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  slideIcon: {
    marginBottom: 32,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    textAlign: 'center',
  },
  skip: {
    position: 'absolute',
    right: 20,
  },
  skipLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    padding: 28,
    paddingBottom: 40,
    backgroundColor: colors.background,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.primary,
  },
  primaryButton: {
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
