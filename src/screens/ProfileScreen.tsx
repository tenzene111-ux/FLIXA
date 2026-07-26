import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Image source={{ uri: 'https://i.pravatar.cc/150?img=12' }} style={styles.avatar} />
      <Text style={styles.name}>{user?.email ?? '@alexcartermusic'}</Text>
      <Text style={styles.bio}>Musician | Creator | Dreamer</Text>

      <View style={styles.statsRow}>
        <Stat label="Following" value="230" />
        <Stat label="Followers" value="125.8K" />
        <Stat label="Likes" value="2.3M" />
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut} activeOpacity={0.85}>
        <Text style={styles.signOutLabel}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingTop: 80,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  bio: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 28,
  },
  stat: {
    alignItems: 'center',
    marginHorizontal: 20,
  },
  statValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  signOutButton: {
    marginTop: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  signOutLabel: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
});
