import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { subscribeToUserPosts } from '../services/posts';
import type { Post } from '../types/post';

const { width } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COLUMNS = 3;
const THUMB_SIZE = (width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const displayName = user?.email ?? 'Flixa user';
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToUserPosts(user.uid, setPosts, () => {});
  }, [user]);

  const totalLikes = useMemo(() => posts.reduce((sum, post) => sum + post.likesCount, 0), [posts]);

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerName} numberOfLines={1}>
          {displayName}
        </Text>
        <TouchableOpacity style={styles.headerAction} onPress={signOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        ListHeaderComponent={
          <>
            <View style={styles.profileTop}>
              <LinearGradient
                colors={colors.gradient}
                style={styles.avatarRing}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
                </View>
              </LinearGradient>

              <View style={styles.statsRow}>
                <Stat label="Videos" value={String(posts.length)} />
                <Stat label="Likes" value={formatCount(totalLikes)} />
              </View>

              <TouchableOpacity style={styles.editButton} activeOpacity={0.85}>
                <Text style={styles.editButtonLabel}>Edit Profile</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.gridHeader}>
              <View style={[styles.gridTab, styles.gridTabActive]}>
                <Ionicons name="grid-outline" size={18} color={colors.text} />
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="videocam-outline" size={40} color={colors.textDim} />
            <Text style={styles.emptyTitle}>No videos yet</Text>
            <Text style={styles.emptySubtitle}>Tap the + button to post your first video</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.gridThumb}>
            <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} />
            <View style={styles.gridThumbViews}>
              <Ionicons name="heart" size={11} color={colors.text} />
              <Text style={styles.gridThumbViewsLabel}>{formatCount(item.likesCount)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
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
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    maxWidth: '80%',
  },
  headerAction: {
    marginLeft: 'auto',
    padding: 4,
  },
  profileTop: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  avatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: colors.background,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  stat: {
    alignItems: 'center',
    marginHorizontal: 24,
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
  editButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 28,
    marginTop: 18,
  },
  editButtonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  gridTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  gridTabActive: {
    borderTopWidth: 2,
    borderTopColor: colors.text,
    marginTop: -1,
  },
  gridRow: {
    gap: GRID_GAP,
  },
  gridThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE * 1.4,
    justifyContent: 'flex-end',
    padding: 6,
    marginBottom: GRID_GAP,
    backgroundColor: colors.surfaceAlt,
  },
  gridThumbViews: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  gridThumbViewsLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 6,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
