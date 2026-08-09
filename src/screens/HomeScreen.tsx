import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import VideoCard from '../components/VideoCard';
import LiveFeedCard from '../components/LiveFeedCard';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { getPostsByCreators } from '../services/posts';
import { subscribeToFollowingUids } from '../services/follows';
import { getForYouFeed, explainRecommendation, type CandidateSource } from '../services/recommendations';
import {
  subscribeToInterestProfile,
  subscribeToHiddenCreators,
  subscribeToHiddenSounds,
  soundIdFor,
} from '../services/interestProfile';
import { getActiveLiveStreams } from '../services/live';
import { EMPTY_INTEREST_PROFILE, type InterestProfile } from '../types/interestProfile';
import type { Post } from '../types/post';
import type { LiveStream } from '../types/liveStream';
import type { HomeStackParamList } from '../navigation/HomeStackNavigator';

const { height: windowHeight } = Dimensions.get('window');

type FeedItem = { kind: 'video'; post: Post; reasons: string[] } | { kind: 'live'; stream: LiveStream };

function feedItemKey(item: FeedItem): string {
  return item.kind === 'video' ? `v:${item.post.id}` : `l:${item.stream.id}`;
}

// Mixes a handful of currently-live streams into the ranked For You list
// (spec: LIVE discovery must not require following the host) — one live
// card every LIVE_INTERVAL video cards, never more streams than are
// actually available.
const LIVE_INTERVAL = 6;

function spliceLiveCards(videoItems: FeedItem[], liveStreams: LiveStream[]): FeedItem[] {
  if (liveStreams.length === 0) return videoItems;
  const result: FeedItem[] = [];
  let liveIndex = 0;
  videoItems.forEach((item, i) => {
    result.push(item);
    if ((i + 1) % LIVE_INTERVAL === 0 && liveIndex < liveStreams.length) {
      result.push({ kind: 'live', stream: liveStreams[liveIndex] });
      liveIndex += 1;
    }
  });
  return result;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const isFocused = useIsFocused();
  // The bottom nav is a translucent floating overlay (LiquidTabBar), not a
  // layout-reserving bar, so each card pages against the full window height
  // now — the video sits full-bleed behind the nav rather than stopping
  // short of it.
  const itemHeight = windowHeight;
  const { user } = useAuth();

  const [activeFeed, setActiveFeed] = useState<'following' | 'forYou'>('forYou');
  const [followingUids, setFollowingUids] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<InterestProfile>(EMPTY_INTEREST_PROFILE);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [hiddenCreatorUids, setHiddenCreatorUids] = useState<Set<string>>(new Set());
  const [hiddenSoundIds, setHiddenSoundIds] = useState<Set<string>>(new Set());
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);

  const [forYouItems, setForYouItems] = useState<FeedItem[]>([]);
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingLoading, setFollowingLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // Fetches read the latest personalization signals through refs rather
  // than closing over the state directly — this keeps fetchForYou a stable
  // callback (so an interest-profile update mid-scroll doesn't reshuffle
  // the list the user is already watching) while still using fresh data
  // for the next page/refresh.
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const followingUidsRef = useRef(followingUids);
  followingUidsRef.current = followingUids;
  const hiddenIdsRef = useRef(hiddenIds);
  hiddenIdsRef.current = hiddenIds;
  const hiddenCreatorUidsRef = useRef(hiddenCreatorUids);
  hiddenCreatorUidsRef.current = hiddenCreatorUids;
  const hiddenSoundIdsRef = useRef(hiddenSoundIds);
  hiddenSoundIdsRef.current = hiddenSoundIds;
  const liveStreamsRef = useRef(liveStreams);
  liveStreamsRef.current = liveStreams;
  // Session memory (spec §32): avoid immediately repeating a video or LIVE
  // card already shown this session, across both the initial load and
  // subsequent "load more" pages.
  const shownKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    return subscribeToFollowingUids(user.uid, setFollowingUids);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToInterestProfile(user.uid, setProfile);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToHiddenCreators(user.uid, setHiddenCreatorUids);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToHiddenSounds(user.uid, setHiddenSoundIds);
  }, [user]);

  useEffect(() => {
    getActiveLiveStreams(6)
      .then(setLiveStreams)
      .catch(() => {});
  }, []);

  const isExcludedFromForYou = useCallback((post: Post) => {
    return (
      hiddenIdsRef.current.has(post.id) ||
      shownKeysRef.current.has(`v:${post.id}`) ||
      hiddenCreatorUidsRef.current.has(post.uid) ||
      (!!post.musicTitle && hiddenSoundIdsRef.current.has(soundIdFor(post.musicTitle)))
    );
  }, []);

  const fetchForYou = useCallback(
    async (mode: 'reset' | 'append') => {
      if (!user) return;
      if (mode === 'reset') shownKeysRef.current.clear();

      const ranked = await getForYouFeed({
        followingUids: Array.from(followingUidsRef.current),
        profile: profileRef.current,
        isExcluded: isExcludedFromForYou,
      });

      const videoItems: FeedItem[] = ranked.map((r) => ({
        kind: 'video',
        post: r.post,
        reasons: explainRecommendation(r.post, r.sources as CandidateSource[], profileRef.current),
      }));

      const availableLive = liveStreamsRef.current.filter((s) => !shownKeysRef.current.has(`l:${s.id}`));
      const withLive = spliceLiveCards(videoItems, availableLive);
      withLive.forEach((item) => shownKeysRef.current.add(feedItemKey(item)));

      setForYouItems((prev) => (mode === 'reset' ? withLive : [...prev, ...withLive]));
    },
    [user, isExcludedFromForYou]
  );

  const fetchFollowing = useCallback(async () => {
    if (!user) return;
    const uids = Array.from(followingUidsRef.current);
    const posts = uids.length ? await getPostsByCreators(uids, 15) : [];
    setFollowingPosts(posts);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchForYou('reset').finally(() => setLoading(false));
    // Only on first load / user change — profile/following updates apply
    // to the *next* fetch (refresh or load-more), not a mid-scroll reshuffle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user || activeFeed !== 'following') return;
    setFollowingLoading(true);
    fetchFollowing().finally(() => setFollowingLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeFeed]);

  const onRefresh = () => {
    setRefreshing(true);
    const run = async () => {
      if (activeFeed === 'following') {
        await fetchFollowing();
        return;
      }
      // Mutate the ref directly (not just via the render-time mirror
      // effect below) so the fetchForYou call right after this actually
      // sees the freshly-fetched streams instead of last render's list.
      try {
        const streams = await getActiveLiveStreams(6);
        liveStreamsRef.current = streams;
        setLiveStreams(streams);
      } catch {
        // keep the previous live list on failure
      }
      await fetchForYou('reset');
    };
    run().finally(() => setRefreshing(false));
  };

  const onEndReached = () => {
    if (activeFeed !== 'forYou' || loadingMore) return;
    setLoadingMore(true);
    fetchForYou('append').finally(() => setLoadingMore(false));
  };

  const visibleForYou = forYouItems.filter((item) => item.kind === 'live' || !hiddenIds.has(item.post.id));
  const visibleFollowing = followingPosts.filter((post) => !hiddenIds.has(post.id));

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      setActiveKey(String(viewableItems[0].key));
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const renderVideoItem = useCallback(
    (post: Post, reasons: string[] | undefined) => (
      <VideoCard
        post={post}
        isActive={isFocused && activeKey === `v:${post.id}`}
        height={itemHeight}
        reasons={reasons}
        onPressAuthor={() => navigation.navigate('UserProfile', { uid: post.uid })}
        onPressComments={() =>
          navigation.navigate('Comments', { postId: post.id, postOwnerUid: post.uid, postThumbnailUrl: post.thumbnailUrl })
        }
        onNotInterested={() => setHiddenIds((prev) => new Set(prev).add(post.id))}
      />
    ),
    [activeKey, isFocused, navigation, itemHeight]
  );

  const renderForYouItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.kind === 'live') {
        return (
          <LiveFeedCard
            stream={item.stream}
            height={itemHeight}
            onPress={() => navigation.navigate('LiveViewer', { streamId: item.stream.id })}
          />
        );
      }
      return renderVideoItem(item.post, item.reasons);
    },
    [itemHeight, navigation, renderVideoItem]
  );

  const renderFollowingItem = useCallback(
    ({ item }: { item: Post }) => renderVideoItem(item, ['You follow this creator']),
    [renderVideoItem]
  );

  const isLoading = activeFeed === 'following' ? followingLoading : loading;
  const data = activeFeed === 'following' ? visibleFollowing : visibleForYou;

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="videocam-outline" size={48} color={colors.textDim} />
          <Text style={styles.emptyTitle}>
            {activeFeed === 'following' ? 'No videos from people you follow' : 'No videos yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeFeed === 'following' ? 'Follow creators to see their videos here' : 'Be the first to post on Flixa'}
          </Text>
        </View>
      ) : activeFeed === 'following' ? (
        <FlatList
          data={visibleFollowing}
          keyExtractor={(item) => item.id}
          renderItem={renderFollowingItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({ length: itemHeight, offset: itemHeight * index, index })}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
        />
      ) : (
        <FlatList
          data={visibleForYou}
          keyExtractor={feedItemKey}
          renderItem={renderForYouItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({ length: itemHeight, offset: itemHeight * index, index })}
          onEndReachedThreshold={2}
          onEndReached={onEndReached}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
        />
      )}

      <View style={[styles.header, { top: insets.top + 8 }]} pointerEvents="box-none">
        <TouchableOpacity onPress={() => setActiveFeed('following')} style={styles.headerTab}>
          <Text style={[styles.headerTabText, activeFeed !== 'following' && styles.headerTabTextInactive]}>
            Following
          </Text>
          {activeFeed === 'following' && <View style={styles.headerTabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveFeed('forYou')} style={styles.headerTab}>
          <Text style={[styles.headerTabText, activeFeed !== 'forYou' && styles.headerTabTextInactive]}>
            For You
          </Text>
          {activeFeed === 'forYou' && <View style={styles.headerTabUnderline} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => (navigation as any).getParent()?.navigate('Explore')}
        >
          <Ionicons name="search" size={22} color={colors.text} />
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTab: {
    alignItems: 'center',
    marginHorizontal: 14,
  },
  headerTabText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerTabTextInactive: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  headerTabUnderline: {
    marginTop: 6,
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  searchButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
});
