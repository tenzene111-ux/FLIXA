import React from 'react';
import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import type { VideoPost } from '../data/videos';

const { width, height } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 60;

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
      <View style={styles.scrim} pointerEvents="none" />

      <View style={styles.rightActions}>
        <View style={styles.avatarWrap}>
          <Image source={{ uri: post.avatar }} style={styles.avatarLarge} />
          <View style={styles.followBadge}>
            <Ionicons name="add" size={12} color={colors.text} />
          </View>
        </View>
        <ActionIcon icon="heart" label={post.likes} color={colors.pink} />
        <ActionIcon icon="chatbubble-ellipses" label={post.comments} />
        <ActionIcon icon="arrow-redo" label={post.shares} />
        <View style={styles.discSpin}>
          <Image source={{ uri: post.avatar }} style={styles.discImage} />
        </View>
      </View>

      <View style={styles.bottomInfo}>
        <View style={styles.usernameRow}>
          <Text style={styles.username}>{post.username}</Text>
          <Ionicons name="checkmark-circle" size={15} color={colors.cyan} style={styles.verifiedBadge} />
        </View>
        <Caption text={post.caption} />
        <View style={styles.songRow}>
          <Ionicons name="musical-notes" size={13} color={colors.text} />
          <Text style={styles.song} numberOfLines={1}>
            {post.song}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Caption({ text }: { text: string }) {
  const parts = text.split(/(#[a-zA-Z0-9_]+)/g);
  return (
    <Text style={styles.caption}>
      {parts.map((part, index) =>
        part.startsWith('#') ? (
          <Text key={index} style={styles.hashtag}>
            {part}
          </Text>
        ) : (
          <Text key={index}>{part}</Text>
        )
      )}
    </Text>
  );
}

function ActionIcon({
  icon,
  label,
  color = colors.text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
}) {
  return (
    <View style={styles.actionItem}>
      <Ionicons name={icon} size={30} color={color} />
      <Text style={styles.actionLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,3,15,0.25)',
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: 110,
    alignItems: 'center',
  },
  avatarWrap: {
    marginBottom: 22,
  },
  avatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.text,
  },
  followBadge: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
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
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  discSpin: {
    marginTop: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.surface,
    overflow: 'hidden',
  },
  discImage: {
    width: '100%',
    height: '100%',
  },
  bottomInfo: {
    paddingHorizontal: 16,
    paddingRight: 90,
    paddingBottom: 20,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  username: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  verifiedBadge: {
    marginLeft: 5,
  },
  caption: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 8,
  },
  hashtag: {
    color: colors.cyan,
    fontWeight: '600',
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  song: {
    color: colors.text,
    fontSize: 13,
    marginLeft: 6,
    flexShrink: 1,
  },
});
