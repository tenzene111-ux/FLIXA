import React from 'react';
import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import type { VideoPost } from '../data/videos';

const { width, height } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 64;

type Props = {
  post: VideoPost;
};

export default function VideoCard({ post }: Props) {
  return (
    <View style={[styles.card, { width, height: height - TAB_BAR_HEIGHT }]}>
      <LinearGradient
        colors={post.gradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      />

      <View style={styles.rightActions}>
        <Image source={{ uri: post.avatar }} style={styles.avatarLarge} />
        <ActionIcon icon="heart" label={post.likes} />
        <ActionIcon icon="chatbubble-ellipses" label={post.comments} />
        <ActionIcon icon="arrow-redo" label={post.shares} />
        <View style={styles.discSpin}>
          <Ionicons name="disc" size={26} color={colors.text} />
        </View>
      </View>

      <View style={styles.bottomInfo}>
        <Text style={styles.username}>{post.username}</Text>
        <Text style={styles.caption}>{post.caption}</Text>
        <View style={styles.songRow}>
          <Ionicons name="musical-notes" size={14} color={colors.text} />
          <Text style={styles.song}>{post.song}</Text>
        </View>
      </View>
    </View>
  );
}

function ActionIcon({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.actionItem}>
      <Ionicons name={icon} size={30} color={colors.text} />
      <Text style={styles.actionLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    justifyContent: 'flex-end',
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: 110,
    alignItems: 'center',
  },
  avatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.text,
    marginBottom: 20,
  },
  actionItem: {
    alignItems: 'center',
    marginBottom: 18,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  discSpin: {
    marginTop: 6,
  },
  bottomInfo: {
    paddingHorizontal: 16,
    paddingRight: 90,
    paddingBottom: 24,
  },
  username: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  caption: {
    color: colors.text,
    fontSize: 14,
    marginBottom: 8,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  song: {
    color: colors.text,
    fontSize: 13,
    marginLeft: 6,
  },
});
