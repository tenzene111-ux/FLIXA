import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';
import { getVideosByMusicTitle } from '../services/explore';
import type { Post } from '../types/post';
import type { ExploreStackParamList } from '../navigation/ExploreStackNavigator';

const GRID_COLUMNS = 3;

export default function SoundPageScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ExploreStackParamList>>();
  const route = useRoute<RouteProp<ExploreStackParamList, 'Sound'>>();
  const musicTitle = route.params.musicTitle;

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    setLoading(true);
    getVideosByMusicTitle(musicTitle)
      .then(setPosts)
      .finally(() => setLoading(false));
  }, [musicTitle]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sound</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.soundCard}>
        <LinearGradient colors={colors.gradient} style={styles.soundIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="musical-notes" size={22} color={colors.text} />
        </LinearGradient>
        <View style={styles.soundInfo}>
          <Text style={styles.soundTitle} numberOfLines={2}>
            {musicTitle}
          </Text>
          <Text style={styles.soundUsage}>Used in {posts.length.toLocaleString()} videos</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes-outline" size={40} color={colors.textDim} />
              <Text style={styles.emptyTitle}>No videos with this sound yet</Text>
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
    paddingBottom: 12,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  soundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  soundIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundInfo: {
    flex: 1,
  },
  soundTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  soundUsage: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
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
