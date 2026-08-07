import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Image, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { getPostsByIds, subscribeToUserPosts } from '../services/posts';
import { subscribeSavedVideoIds } from '../services/savedVideos';
import type { Post } from '../types/post';
import type { ProfileStackParamList } from '../navigation/ProfileStackNavigator';

type GridTab = 'posts' | 'saved' | 'tagged';

const { width } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COLUMNS = 3;
const THUMB_SIZE = (width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const route = useRoute<RouteProp<ProfileStackParamList, 'MyProfile'>>();
  const { user } = useAuth();
  const profile = useUserProfile(user?.uid);
  const displayName = profile?.displayName ?? '...';
  const username = profile?.username ?? '...';
  const [posts, setPosts] = useState<Post[]>([]);
  const [gridTab, setGridTab] = useState<GridTab>(route.params?.initialTab ?? 'posts');
  const [savedVideoIds, setSavedVideoIds] = useState<string[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToUserPosts(user.uid, setPosts, () => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeSavedVideoIds(user.uid, setSavedVideoIds);
  }, [user]);

  useEffect(() => {
    getPostsByIds(savedVideoIds).then(setSavedPosts).catch(() => {});
  }, [savedVideoIds]);

  const totalLikes = useMemo(() => posts.reduce((sum, post) => sum + post.likesCount, 0), [posts]);
  const gridVideos = gridTab === 'posts' ? posts : gridTab === 'saved' ? savedPosts : [];

  const handleShare = () => {
    Share.share({ message: `Check out @${username} on Flixa!` }).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerName} numberOfLines={1}>
          @{username}
        </Text>
        <TouchableOpacity style={styles.headerAction} onPress={() => navigation.navigate('Menu')}>
          <Ionicons name="menu-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={gridVideos}
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
                {profile?.photoURL ? (
                  <Image source={{ uri: profile.photoURL }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>{username.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </LinearGradient>

              <Text style={styles.displayName}>{displayName}</Text>

              <View style={styles.statsRow}>
                <Stat label="Following" value={formatCount(profile?.followingCount ?? 0)} />
                <Stat label="Followers" value={formatCount(profile?.followersCount ?? 0)} />
                <Stat label="Likes" value={formatCount(totalLikes)} />
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.editButton}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('EditProfile')}
                >
                  <Text style={styles.editButtonLabel}>Edit Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
                  <Ionicons name="share-outline" size={18} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => setGridTab('saved')}>
                  <Ionicons name="bookmark-outline" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
            </View>

            <View style={styles.gridHeader}>
              <TouchableOpacity
                style={[styles.gridTab, gridTab === 'posts' && styles.gridTabActive]}
                onPress={() => setGridTab('posts')}
              >
                <Ionicons name="grid-outline" size={18} color={gridTab === 'posts' ? colors.text : colors.textDim} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.gridTab, gridTab === 'saved' && styles.gridTabActive]}
                onPress={() => setGridTab('saved')}
              >
                <Ionicons name="bookmark-outline" size={18} color={gridTab === 'saved' ? colors.text : colors.textDim} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.gridTab, gridTab === 'tagged' && styles.gridTabActive]}
                onPress={() => setGridTab('tagged')}
              >
                <Ionicons name="pricetag-outline" size={18} color={gridTab === 'tagged' ? colors.text : colors.textDim} />
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="videocam-outline" size={40} color={colors.textDim} />
            <Text style={styles.emptyTitle}>
              {gridTab === 'posts' ? 'No videos yet' : gridTab === 'saved' ? 'No saved videos yet' : 'No tagged videos yet'}
            </Text>
            {gridTab === 'posts' ? (
              <Text style={styles.emptySubtitle}>Tap the + button to post your first video</Text>
            ) : null}
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
    paddingHorizontal: 24,
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
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: colors.background,
  },
  avatarInitial: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
  },
  displayName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 18,
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 10,
  },
  editButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 28,
  },
  editButtonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bio: {
    color: colors.text,
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
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
