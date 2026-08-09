import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { getVideosByHashtag } from '../services/explore';
import type { Post } from '../types/post';
import type { ExploreStackParamList } from '../navigation/ExploreStackNavigator';

const GRID_COLUMNS = 3;
type SortTab = 'top' | 'latest';

export default function HashtagPageScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ExploreStackParamList>>();
  const route = useRoute<RouteProp<ExploreStackParamList, 'Hashtag'>>();
  const tag = route.params.tag;

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [sortTab, setSortTab] = useState<SortTab>('top');

  useEffect(() => {
    setLoading(true);
    getVideosByHashtag(tag)
      .then(setPosts)
      .finally(() => setLoading(false));
  }, [tag]);

  const sorted = [...posts].sort((a, b) => (sortTab === 'top' ? b.likesCount - a.likesCount : b.createdAt - a.createdAt));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>#{tag}</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.countLabel}>{posts.length.toLocaleString()} videos</Text>

      <View style={styles.tabsRow}>
        <TouchableOpacity style={[styles.tab, sortTab === 'top' && styles.tabActive]} onPress={() => setSortTab('top')}>
          <Text style={[styles.tabLabel, sortTab === 'top' && styles.tabLabelActive]}>Top</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, sortTab === 'latest' && styles.tabActive]} onPress={() => setSortTab('latest')}>
          <Text style={[styles.tabLabel, sortTab === 'latest' && styles.tabLabelActive]}>Latest</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="pricetag-outline" size={40} color={colors.textDim} />
              <Text style={styles.emptyTitle}>No videos with #{tag} yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.gridThumb} onPress={() => navigation.navigate('SingleVideo', { postId: item.id })} activeOpacity={0.85}>
              <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} />
              <View style={styles.gridThumbLikes}>
                <Ionicons name="heart" size={11} color={colors.text} />
                <Text style={styles.gridThumbLikesLabel}>{item.likesCount.toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  countLabel: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
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
  loading: {
    marginTop: 40,
  },
  gridContent: {
    paddingHorizontal: 2,
  },
  gridRow: {
    gap: 2,
  },
  gridThumb: {
    flex: 1 / GRID_COLUMNS,
    aspectRatio: 0.72,
    backgroundColor: colors.surfaceAlt,
    margin: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  gridThumbLikes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    padding: 6,
  },
  gridThumbLikesLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
    width: '100%',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
