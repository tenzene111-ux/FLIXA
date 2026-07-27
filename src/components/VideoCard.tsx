import React from 'react';
import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { TAB_BAR_HEIGHT } from '../theme/layout';
import type { VideoPost } from '../data/videos';

const { width, height } = Dimensions.get('window');

type Props = {
  post: VideoPost;
};

export default function VideoCard({ post }: Props) {
  const insets = useSafeAreaInsets();
  const navClearance = TAB_BAR_HEIGHT + insets.bottom;

  return (
    <View style={[styles.card, { width, height }]}>
      <LinearGradient
        colors={post.gradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      />
      <View style={styles.scrim} pointerEvents="none" />

      <View style={[styles.rightActions, { bottom: 110 + navClearance }]}>
        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={colors.gradient}
            style={styles.avatarRing}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Image source={{ uri: post.avatar }} style={styles.avatarLarge} />
          </LinearGradient>
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

      <View style={[styles.bottomInfo, { paddingBottom: 20 + navClearance }]}>
        <View style={styles.usernameRow}>
          <Text style={styles.username}>{post.username}</Text>
          <Ionicons name="checkmark-circle" size={15} color={colors.cyan} style={styles.verifiedBadge} />
        </View>
        <Caption text={post.caption} />
        <BlurView intensity={40} tint="dark" style={styles.songPill}>
          <Ionicons name="musical-notes" size={13} color={colors.text} />
          <Text style={styles.song} numberOfLines={1}>
            {post.song}
          </Text>
        </BlurView>
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
  avatarRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.glowPurple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.background,
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
    shadowColor: colors.glowPink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
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
  songPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  song: {
    color: colors.text,
    fontSize: 13,
    marginLeft: 6,
    flexShrink: 1,
  },
});
