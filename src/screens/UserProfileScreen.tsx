import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';
import { subscribeToUserPosts } from '../services/posts';
import { useUserProfile } from '../hooks/useUserProfile';
import { useAuth } from '../context/AuthContext';
import { followUser, subscribeToFollowState, unfollowUser } from '../services/follows';
import { getOrCreateConversation } from '../services/messages';
import { logEvent } from '../services/analytics';
import type { Post } from '../types/post';

const { width } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COLUMNS = 3;
const THUMB_SIZE = (width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

type UserProfileParamList = { UserProfile: { uid: string } };

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<UserProfileParamList, 'UserProfile'>>();
  const profile = useUserProfile(params.uid);
  const { user } = useAuth();
  const viewerProfile = useUserProfile(user?.uid);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);

  useEffect(() => {
    return subscribeToUserPosts(params.uid, setPosts, () => {});
  }, [params.uid]);

  useEffect(() => {
    if (!user) return;
    return subscribeToFollowState(user.uid, params.uid, setIsFollowing);
  }, [user, params.uid]);

  const totalLikes = useMemo(() => posts.reduce((sum, post) => sum + post.likesCount, 0), [posts]);
  const displayName = profile?.displayName ?? '...';
  const username = profile?.username ?? '...';
  const isOwnProfile = user?.uid === params.uid;

  const handleToggleFollow = async () => {
    if (!user || !viewerProfile || followBusy) return;
    setFollowBusy(true);
    try {
      if (isFollowing) {
        await unfollowUser({ followerUid: user.uid, followingUid: params.uid });
      } else {
        await followUser({ followerUid: user.uid, followerUsername: viewerProfile.username, followingUid: params.uid });
        logEvent('follow', user.uid, { targetUid: params.uid });
      }
    } finally {
      setFollowBusy(false);
    }
  };

  const handleMessage = async () => {
    if (!user || messageBusy) return;
    setMessageBusy(true);
    try {
      const conversationId = await getOrCreateConversation(user.uid, params.uid);
      (navigation as any).getParent()?.navigate('Inbox', {
        screen: 'Chat',
        params: { conversationId, otherUid: params.uid },
      });
    } finally {
      setMessageBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        ListHeaderComponent={
          <>
            <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity onPress={navigation.goBack} hitSlop={8}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.headerName} numberOfLines={1}>
                @{username}
              </Text>
              <View style={styles.headerSpacer} />
            </View>

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

              {!isOwnProfile && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.followButton, isFollowing && styles.followingButton]}
                    onPress={handleToggleFollow}
                    disabled={followBusy}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.followButtonLabel, isFollowing && styles.followingButtonLabel]}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.messageButton}
                    onPress={handleMessage}
                    disabled={messageBusy}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="paper-plane-outline" size={16} color={colors.text} />
                    <Text style={styles.messageButtonLabel}>Message</Text>
                  </TouchableOpacity>
                </View>
              )}

              {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
            </View>

            <View style={styles.gridHeader}>
              <View style={[styles.gridTab, styles.gridTabActive]}>
                <Ionicons name="grid-outline" size={18} color={colors.text} />
              </View>
              <View style={styles.gridTab}>
                <Ionicons name="bookmark-outline" size={18} color={colors.textDim} />
              </View>
              <View style={styles.gridTab}>
                <Ionicons name="pricetag-outline" size={18} color={colors.textDim} />
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="videocam-outline" size={40} color={colors.textDim} />
            <Text style={styles.emptyTitle}>No videos yet</Text>
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
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 24,
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
  bio: {
    color: colors.text,
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 10,
  },
  followButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 28,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 18,
    gap: 6,
  },
  messageButtonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  followButtonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  followingButtonLabel: {
    color: colors.textMuted,
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
});
