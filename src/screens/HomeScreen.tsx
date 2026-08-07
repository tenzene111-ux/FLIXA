import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import VideoCard from '../components/VideoCard';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { subscribeToFeed } from '../services/posts';
import { subscribeToFollowingUids } from '../services/follows';
import type { Post } from '../types/post';
import type { HomeStackParamList } from '../navigation/HomeStackNavigator';

const { height: windowHeight } = Dimensions.get('window');

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();
  const itemHeight = windowHeight - tabBarHeight;
  const { user } = useAuth();
  const [activeFeed, setActiveFeed] = useState<'following' | 'forYou'>('forYou');
  const [posts, setPosts] = useState<Post[]>([]);
  const [followingUids, setFollowingUids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToFeed(
      (nextPosts) => {
        setPosts(nextPosts);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeToFollowingUids(user.uid, setFollowingUids);
  }, [user]);

  const visiblePosts = activeFeed === 'following' ? posts.filter((post) => followingUids.has(post.uid)) : posts;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      setActiveId(String(viewableItems[0].key));
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const renderItem = useCallback(
    ({ item }: { item: Post }) => (
      <VideoCard
        post={item}
        isActive={isFocused && item.id === activeId}
        height={itemHeight}
        onPressAuthor={() => navigation.navigate('UserProfile', { uid: item.uid })}
        onPressComments={() =>
          navigation.navigate('Comments', { postId: item.id, postOwnerUid: item.uid, postThumbnailUrl: item.thumbnailUrl })
        }
      />
    ),
    [activeId, isFocused, navigation, itemHeight]
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : visiblePosts.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="videocam-outline" size={48} color={colors.textDim} />
          <Text style={styles.emptyTitle}>
            {activeFeed === 'following' ? 'No videos from people you follow' : 'No videos yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeFeed === 'following' ? 'Follow creators to see their videos here' : 'Be the first to post on Flixa'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visiblePosts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({
            length: itemHeight,
            offset: itemHeight * index,
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
