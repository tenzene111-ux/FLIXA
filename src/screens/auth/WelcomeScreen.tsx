import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import colors from '../../theme/colors';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={colors.gradient} style={styles.container} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}>
      <View style={styles.scrim} />

      <TouchableOpacity
        style={[styles.skip, { top: insets.top + 12 }]}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.skipLabel}>Skip</Text>
      </TouchableOpacity>

      <View style={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.dots}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>

        <Text style={styles.title}>Welcome to Flixa</Text>
        <Text style={styles.subtitle}>A world of short videos, made for you.</Text>

        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('SignUp')}
        >
          <Text style={styles.primaryButtonLabel}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.secondaryButtonLabel}>Log In</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,3,15,0.35)',
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
  content: {
    marginTop: 'auto',
    paddingHorizontal: 28,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.text,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  primaryButton: {
    backgroundColor: colors.pink,
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
