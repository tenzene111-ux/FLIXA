import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../navigation/MainTabNavigator';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';
import {
  getPopularCreators,
  getTopPost,
  getTrendingHashtags,
  searchUsersByUsername,
  type PopularCreator,
  type TrendingHashtag,
} from '../services/explore';
import type { Post } from '../types/post';
import type { UserProfile } from '../types/userProfile';
import type { ExploreStackParamList } from '../navigation/ExploreStackNavigator';

const TABS = ['Trending', 'Sounds', 'Effects', 'Live', 'Topics'];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ExploreStackParamList>>();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [loading, setLoading] = useState(true);
  const [topPost, setTopPost] = useState<Post | null>(null);
  const [hashtags, setHashtags] = useState<TrendingHashtag[]>([]);
  const [creators, setCreators] = useState<PopularCreator[]>([]);

  useEffect(() => {
    Promise.all([getTopPost(), getTrendingHashtags(), getPopularCreators()])
      .then(([post, tags, popularCreators]) => {
        setTopPost(post);
        setHashtags(tags);
        setCreators(popularCreators);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = async (text: string) => {
    setSearchTerm(text);
    if (!text.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const results = await searchUsersByUsername(text);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  };

  const goToUser = (uid: string) => navigation.navigate('UserProfile', { uid });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Explore</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search creators"
            placeholderTextColor={colors.textDim}
            value={searchTerm}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
        </View>
      </View>

      {searchResults !== null ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            searching ? (
              <ActivityIndicator color={colors.primary} style={styles.emptySpacing} />
            ) : (
              <Text style={styles.emptyText}>No creators found</Text>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userRow} onPress={() => goToUser(item.uid)}>
              <View style={styles.userAvatar}>
                {item.photoURL ? (
                  <Image source={{ uri: item.photoURL }} style={styles.userAvatarImage} />
                ) : (
                  <Text style={styles.userAvatarInitial}>{item.username.charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <View>
                <Text style={styles.userName}>{item.displayName}</Text>
                <Text style={styles.userHandle}>@{item.username}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          <View style={styles.tabsRow}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, tab === 'Trending' && styles.tabActive]}
                onPress={() => {
                  if (tab === 'Live') {
                    navigation.getParent<BottomTabNavigationProp<MainTabParamList>>()?.navigate('Home', { screen: 'LiveList' });
                  } else if (tab !== 'Trending') {
                    Alert.alert(tab, 'Coming soon');
                  }
                }}
              >
                <Text style={[styles.tabLabel, tab === 'Trending' && styles.tabLabelActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.emptySpacing} />
          ) : (
            <>
              {topPost ? (
                <LinearGradient
                  colors={colors.gradient}
                  style={styles.trendingBanner}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Image source={{ uri: topPost.thumbnailUrl }} style={StyleSheet.absoluteFill} />
                  <View style={styles.trendingBannerScrim} />
                  <Text style={styles.trendingBannerLabel}>Trending Now</Text>
                  <Text style={styles.trendingBannerCaption} numberOfLines={1}>
                    {topPost.caption || 'Check out this video'}
                  </Text>
                </LinearGradient>
              ) : null}

              <Text style={styles.sectionTitle}>Trending Hashtags</Text>
              {hashtags.length === 0 ? (
                <Text style={styles.emptyText}>No hashtags yet — post a video with a #hashtag!</Text>
              ) : (
                hashtags.map((tag) => (
                  <View key={tag.tag} style={styles.hashtagRow}>
                    <View style={styles.hashtagIcon}>
                      <Text style={styles.hashtagIconLabel}>#</Text>
                    </View>
                    <View style={styles.hashtagInfo}>
                      <Text style={styles.hashtagName}>{tag.tag}</Text>
                      <Text style={styles.hashtagCount}>{tag.count} videos</Text>
                    </View>
                  </View>
                ))
              )}

              <Text style={styles.sectionTitle}>Popular Creators</Text>
              {creators.length === 0 ? (
                <Text style={styles.emptyText}>No creators yet</Text>
              ) : (
                creators.map((creator) => (
                  <TouchableOpacity key={creator.uid} style={styles.userRow} onPress={() => goToUser(creator.uid)}>
                    <View style={styles.userAvatar}>
                      {creator.photoURL ? (
                        <Image source={{ uri: creator.photoURL }} style={styles.userAvatarImage} />
                      ) : (
                        <Text style={styles.userAvatarInitial}>{creator.username.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={styles.creatorInfo}>
                      <Text style={styles.userName}>{creator.displayName}</Text>
                      <Text style={styles.userHandle}>@{creator.username}</Text>
                    </View>
                    <Text style={styles.creatorLikes}>{creator.totalLikes} likes</Text>
                  </TouchableOpacity>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  tabsRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.text,
  },
  trendingBanner: {
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 16,
    marginBottom: 24,
  },
  trendingBannerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,3,15,0.35)',
  },
  trendingBannerLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  trendingBannerCaption: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  hashtagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  hashtagIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hashtagIconLabel: {
    color: colors.cyan,
    fontSize: 18,
    fontWeight: '700',
  },
  hashtagInfo: {
    flex: 1,
  },
  hashtagName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  hashtagCount: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
  },
  userAvatarInitial: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  userName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  userHandle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  creatorInfo: {
    flex: 1,
  },
  creatorLikes: {
    color: colors.textMuted,
    fontSize: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 14,
  },
  emptySpacing: {
    marginVertical: 24,
  },
});
