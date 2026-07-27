import React, { useCallback, useRef, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import VideoCard from '../components/VideoCard';
import { fetchFeedVideosPage, type FeedPage } from '../services/videos';
import colors from '../theme/colors';
import type { FeedVideo } from '../types/models';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

const { height } = Dimensions.get('window');
const ITEM_HEIGHT = height;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [activeFeed, setActiveFeed] = useState<'following' | 'forYou'>('forYou');
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const applyPage = (page: FeedPage, append: boolean) => {
    setVideos((prev) => (append ? [...prev, ...page.videos] : page.videos));
    setCursor(page.cursor);
    setHasMore(page.hasMore);
  };

  const loadFirstPage = useCallback(async () => {
    const page = await fetchFeedVideosPage();
    applyPage(page, false);
  }, []);

  // Feed reads are paginated, one-time fetches rather than a live listener
  // (see services/videos.ts), so a freshly posted video won't push itself
  // in automatically — refetching on focus is what surfaces it, the same
  // way pulling to refresh does.
  useFocusEffect(
    useCallback(() => {
      loadFirstPage();
    }, [loadFirstPage])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadFirstPage();
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchFeedVideosPage(cursor);
      applyPage(page, true);
    } finally {
      setLoadingMore(false);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const feedVideos = activeFeed === 'forYou' ? videos : [];

  return (
    <View style={styles.container}>
      {feedVideos.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name={activeFeed === 'following' ? 'people-outline' : 'videocam-outline'}
            size={40}
            color={colors.textDim}
          />
          <Text style={styles.emptyText}>
            {activeFeed === 'following'
              ? 'Videos from creators you follow will show up here.'
              : 'No videos yet. Tap Create to post the first one!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={feedVideos}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <VideoCard post={item} isActive={index === activeIndex} />}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={1.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.text} />
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.text} style={styles.loadMore} /> : null}
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
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

        <TouchableOpacity style={styles.searchButton}>
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    gap: 12,
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadMore: {
    paddingVertical: 24,
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
