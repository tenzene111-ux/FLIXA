import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { subscribeToLiveStream } from '../services/live';
import { subscribeToGiftLeaderboard, type GiftLeaderboardEntry } from '../services/gifts';
import type { LiveStream } from '../types/liveStream';
import type { HomeStackParamList } from '../navigation/HomeStackNavigator';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function LiveAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const route = useRoute<RouteProp<HomeStackParamList, 'LiveAnalytics'>>();
  const { streamId } = route.params;

  const [stream, setStream] = useState<LiveStream | null>(null);
  const [leaderboard, setLeaderboard] = useState<GiftLeaderboardEntry[]>([]);

  useEffect(() => subscribeToLiveStream(streamId, setStream), [streamId]);
  useEffect(() => subscribeToGiftLeaderboard('liveStream', streamId, setLeaderboard), [streamId]);

  const analytics = stream?.analytics ?? null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <Ionicons name="stats-chart" size={22} color={colors.primary} />
        <Text style={styles.headerTitle}>Stream summary</Text>
      </View>
      <Text style={styles.streamTitle} numberOfLines={2}>
        {stream?.title ?? '...'}
      </Text>

      {!analytics ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingLabel}>Crunching the numbers...</Text>
        </View>
      ) : (
        <View style={styles.statsGrid}>
          <StatCard icon="time-outline" label="Duration" value={formatDuration(analytics.durationSec)} />
          <StatCard icon="people-outline" label="Peak viewers" value={String(analytics.peakViewers)} />
          <StatCard icon="eye-outline" label="Total viewers" value={String(analytics.totalUniqueViewers)} />
          <StatCard icon="heart-outline" label="Likes" value={String(stream?.likeCount ?? 0)} />
          <StatCard icon="diamond-outline" label="Diamonds earned" value={String(analytics.totalDiamonds)} />
          <StatCard icon="gift-outline" label="Gifts" value={String(analytics.giftCount)} />
          <StatCard icon="chatbubble-outline" label="Comments" value={String(analytics.commentCount)} />
        </View>
      )}

      <Text style={styles.sectionLabel}>Top gifters</Text>
      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.uid}
        style={styles.leaderboardList}
        ListEmptyComponent={<Text style={styles.emptyLabel}>No gifts this stream</Text>}
        renderItem={({ item, index }) => (
          <View style={styles.leaderboardRow}>
            <Text style={styles.leaderboardRank}>#{index + 1}</Text>
            <Text style={styles.leaderboardName} numberOfLines={1}>
              @{item.username}
            </Text>
            <View style={styles.leaderboardAmount}>
              <Ionicons name="diamond" size={13} color={colors.cyan} />
              <Text style={styles.leaderboardAmountLabel}>{item.totalDiamonds}</Text>
            </View>
          </View>
        )}
      />

      <TouchableOpacity
        style={[styles.doneButton, { marginBottom: insets.bottom + 16 }]}
        onPress={() => navigation.popToTop()}
        activeOpacity={0.85}
      >
        <Text style={styles.doneLabel}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

function StatCard({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={18} color={colors.cyan} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  streamTitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  statCard: {
    width: '31%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 4,
  },
  statValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  leaderboardList: {
    flex: 1,
  },
  emptyLabel: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  leaderboardRank: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    width: 28,
  },
  leaderboardName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  leaderboardAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leaderboardAmountLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
