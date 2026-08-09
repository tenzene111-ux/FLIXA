import React, { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { subscribeToUserPosts } from '../services/posts';
import type { Post } from '../types/post';
import type { ProfileStackParamList } from '../navigation/ProfileStackNavigator';

function formatDuration(sec: number) {
  if (sec <= 0) return '0s';
  return `${sec.toFixed(1)}s`;
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RetentionBar({ label, pct }: { label: string; pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.retentionRow}>
      <Text style={styles.retentionLabel}>{label}</Text>
      <View style={styles.retentionTrack}>
        <View style={[styles.retentionFill, { width: `${clamped}%` }]} />
      </View>
      <Text style={styles.retentionPct}>{Math.round(clamped)}%</Text>
    </View>
  );
}

function VideoDetail({ post, onBack }: { post: Post; onBack: () => void }) {
  const avgWatchSec = post.watchCount > 0 ? post.totalWatchedSec / post.watchCount : 0;
  const completionRate = post.watchCount > 0 ? (post.completedViews / post.watchCount) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.detailCaption} numberOfLines={1}>
          {post.caption || 'Video analytics'}
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <StatTile label="Views" value={post.viewCount} />
        <StatTile label="Likes" value={post.likesCount} />
        <StatTile label="Comments" value={post.commentsCount} />
        <StatTile label="Shares" value={post.shareCount} />
        <StatTile label="Favorites" value={post.saveCount} />
        <StatTile label="Avg watch time" value={formatDuration(avgWatchSec)} />
      </View>

      <View style={styles.completionCard}>
        <Text style={styles.completionLabel}>Completion rate</Text>
        <Text style={styles.completionValue}>{Math.round(completionRate)}%</Text>
      </View>

      <Text style={styles.sectionTitle}>Audience retention</Text>
      {post.watchCount === 0 ? (
        <Text style={styles.emptyHint}>No watch data yet.</Text>
      ) : (
        <View style={styles.retentionCard}>
          <RetentionBar label="Started" pct={100} />
          <RetentionBar label="25%" pct={(post.retain25 / post.watchCount) * 100} />
          <RetentionBar label="50%" pct={(post.retain50 / post.watchCount) * 100} />
          <RetentionBar label="75%" pct={(post.retain75 / post.watchCount) * 100} />
          <RetentionBar label="Completed" pct={(post.completedViews / post.watchCount) * 100} />
        </View>
      )}
    </View>
  );
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToUserPosts(user.uid, setPosts, () => {});
  }, [user]);

  if (selectedPost) {
    const latest = posts.find((p) => p.id === selectedPost.id) ?? selectedPost;
    return <VideoDetail post={latest} onBack={() => setSelectedPost(null)} />;
  }

  const totalViews = posts.reduce((sum, p) => sum + p.viewCount, 0);
  const totalLikes = posts.reduce((sum, p) => sum + p.likesCount, 0);

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.summaryRow}>
        <StatTile label="Total views" value={totalViews} />
        <StatTile label="Total likes" value={totalLikes} />
        <StatTile label="Videos" value={posts.length} />
      </View>

      <Text style={styles.sectionTitle}>Your videos</Text>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="bar-chart-outline" size={40} color={colors.textDim} />
            <Text style={styles.emptyTitle}>No videos yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => setSelectedPost(item)} activeOpacity={0.8}>
            <Image source={{ uri: item.thumbnailUrl }} style={styles.rowThumb} />
            <View style={styles.rowBody}>
              <Text style={styles.rowCaption} numberOfLines={1}>
                {item.caption || 'Untitled video'}
              </Text>
              <View style={styles.rowStats}>
                <Ionicons name="eye-outline" size={13} color={colors.textMuted} />
                <Text style={styles.rowStatValue}>{item.viewCount.toLocaleString()}</Text>
                <Ionicons name="heart-outline" size={13} color={colors.textMuted} style={styles.rowStatIconSpacer} />
                <Text style={styles.rowStatValue}>{item.likesCount.toLocaleString()}</Text>
                <Ionicons name="chatbubble-outline" size={13} color={colors.textMuted} style={styles.rowStatIconSpacer} />
                <Text style={styles.rowStatValue}>{item.commentsCount.toLocaleString()}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </TouchableOpacity>
        )}
      />
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowThumb: {
    width: 54,
    height: 72,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  rowBody: {
    flex: 1,
    gap: 6,
  },
  rowCaption: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowStatValue: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  rowStatIconSpacer: {
    marginLeft: 12,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  detailCaption: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  completionCard: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  completionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  completionValue: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  emptyHint: {
    color: colors.textDim,
    fontSize: 13,
    paddingHorizontal: 16,
  },
  retentionCard: {
    marginHorizontal: 16,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  retentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  retentionLabel: {
    width: 64,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  retentionTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  retentionFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  retentionPct: {
    width: 36,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
});
