import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc } from 'firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import colors from '../theme/colors';
import { TAB_BAR_HEIGHT } from '../theme/layout';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { followExploreCreator, subscribeExploreCreators, subscribeTrendingHashtags } from '../services/explore';
import type { DiscoverStackParamList } from '../navigation/DiscoverStackNavigator';
import type { ExploreCreator, TrendingHashtag } from '../types/models';
import { formatCompactNumber } from '../utils/format';

type Props = NativeStackScreenProps<DiscoverStackParamList, 'Explore'>;

const CATEGORIES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'flame', label: 'Trending' },
  { icon: 'musical-notes-outline', label: 'Sounds' },
  { icon: 'color-wand-outline', label: 'Effects' },
  { icon: 'radio-outline', label: 'Live' },
  { icon: 'pricetags-outline', label: 'Topics' },
];

export default function ExploreScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState('Trending');
  const [hashtags, setHashtags] = useState<TrendingHashtag[]>([]);
  const [creators, setCreators] = useState<ExploreCreator[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => subscribeTrendingHashtags(setHashtags), []);
  useEffect(() => subscribeExploreCreators(setCreators), []);

  useEffect(() => {
    if (!user || creators.length === 0) return;
    Promise.all(
      creators.map(async (c) => {
        const snap = await getDoc(doc(db, 'exploreCreators', c.id, 'followers', user.uid));
        return snap.exists() ? c.id : null;
      })
    ).then((ids) => setFollowingIds(new Set(ids.filter((id): id is string => id !== null))));
  }, [user, creators]);

  const handleFollow = async (creatorId: string) => {
    if (!user) return;
    const didFollow = await followExploreCreator(creatorId, user.uid);
    if (didFollow) {
      setFollowingIds((prev) => new Set(prev).add(creatorId));
    }
  };

  const handleCategoryPress = (label: string) => {
    setActiveCategory(label);
    if (label === 'Live') {
      navigation.navigate('Live');
    }
  };

  return (
    <View style={styles.container}>
      <View style={{ paddingTop: insets.top + 8 }}>
        <Text style={styles.title}>Explore</Text>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.textDim} />
          <TextInput placeholder="Search" placeholderTextColor={colors.textDim} style={styles.searchInput} />
        </View>

        <LinearGradient
          colors={colors.gradient}
          style={styles.banner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.bannerTitle}>Summer Vibes ☀️</Text>
          <Text style={styles.bannerSubtitle}>Trending Now</Text>
        </LinearGradient>

        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => {
            const active = cat.label === activeCategory;
            return (
              <TouchableOpacity key={cat.label} style={styles.categoryItem} onPress={() => handleCategoryPress(cat.label)}>
                <Ionicons name={cat.icon} size={20} color={active ? colors.pink : colors.textMuted} />
                <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trending Hashtags</Text>
          <Text style={styles.seeAll}>See all</Text>
        </View>
        {hashtags.map((h) => (
          <View key={h.id} style={styles.hashtagRow}>
            <View style={styles.hashtagIcon}>
              <Ionicons name="pricetag" size={16} color={colors.pink} />
            </View>
            <View style={styles.hashtagInfo}>
              <Text style={styles.hashtagTag}>{h.tag}</Text>
              <Text style={styles.hashtagViews}>{formatCompactNumber(h.viewCount)} views</Text>
            </View>
          </View>
        ))}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular Creators</Text>
          <Text style={styles.seeAll}>See all</Text>
        </View>
        {creators.map((c) => {
          const isFollowing = followingIds.has(c.id);
          return (
            <View key={c.id} style={styles.creatorRow}>
              <Image source={{ uri: c.avatarUrl }} style={styles.creatorAvatar} />
              <View style={styles.creatorInfo}>
                <Text style={styles.creatorName}>{c.displayName}</Text>
                <Text style={styles.creatorHandle}>{c.handle}</Text>
              </View>
              <Text style={styles.creatorFollowers}>{formatCompactNumber(c.followerCount)}</Text>
              <TouchableOpacity
                style={[styles.followButton, isFollowing && styles.followButtonActive]}
                onPress={() => handleFollow(c.id)}
                disabled={isFollowing}
              >
                <Text style={[styles.followLabel, isFollowing && styles.followLabelActive]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    padding: 18,
    height: 90,
    justifyContent: 'center',
  },
  bannerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  categoryItem: {
    alignItems: 'center',
    gap: 6,
  },
  categoryLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  categoryLabelActive: {
    color: colors.pink,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  seeAll: {
    color: colors.textMuted,
    fontSize: 12,
  },
  hashtagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  hashtagIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  hashtagInfo: {
    flex: 1,
  },
  hashtagTag: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  hashtagViews: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  creatorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  creatorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  creatorName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  creatorHandle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  creatorFollowers: {
    color: colors.textMuted,
    fontSize: 12,
    marginRight: 10,
  },
  followButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  followButtonActive: {
    backgroundColor: colors.surfaceAlt,
  },
  followLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  followLabelActive: {
    color: colors.textMuted,
  },
});
