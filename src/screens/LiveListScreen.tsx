import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { subscribeToLiveStreams } from '../services/live';
import { LIVE_CATEGORIES, type LiveCategory, type LiveStream } from '../types/liveStream';
import type { HomeStackParamList } from '../navigation/HomeStackNavigator';

export default function LiveListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [category, setCategory] = useState<LiveCategory | 'All'>('All');

  useEffect(() => subscribeToLiveStreams(setStreams), []);

  // Most-watched first — real discovery ranking rather than insertion
  // order, using the viewerCount the onLiveViewerJoin/Leave Cloud
  // Function triggers keep denormalized on each stream doc.
  const visibleStreams = useMemo(() => {
    const filtered = category === 'All' ? streams : streams.filter((stream) => stream.category === category);
    return [...filtered].sort((a, b) => b.viewerCount - a.viewerCount);
  }, [streams, category]);

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Now</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow} contentContainerStyle={styles.categoryRowContent}>
        {(['All', ...LIVE_CATEGORIES] as const).map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.categoryChip, category === item && styles.categoryChipActive]}
            onPress={() => setCategory(item)}
          >
            <Text style={[styles.categoryChipLabel, category === item && styles.categoryChipLabelActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={visibleStreams}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="radio-outline" size={40} color={colors.textDim} />
            <Text style={styles.emptyTitle}>No one's live right now</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('LiveViewer', { streamId: item.id })}
            activeOpacity={0.85}
          >
            {item.coverUrl ? (
              <Image source={{ uri: item.coverUrl }} style={styles.cardCover} resizeMode="cover" />
            ) : (
              <View style={[styles.cardCover, styles.cardCoverPlaceholder]} />
            )}
            <View style={styles.cardOverlay} />
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeLabel}>LIVE</Text>
            </View>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeLabel}>{item.category}</Text>
            </View>
            {item.viewerCount > 0 ? (
              <View style={styles.viewerCountBadge}>
                <Ionicons name="eye" size={11} color={colors.text} />
                <Text style={styles.viewerCountLabel}>{item.viewerCount}</Text>
              </View>
            ) : null}
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.cardHost} numberOfLines={1}>
              @{item.hostUsername}
            </Text>
            {item.hashtags.length > 0 ? (
              <Text style={styles.cardHashtags} numberOfLines={1}>
                {item.hashtags.slice(0, 3).join(' ')}
              </Text>
            ) : null}
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
  categoryRow: {
    flexGrow: 0,
    marginBottom: 4,
  },
  categoryRowContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  categoryChipLabelActive: {
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    flexGrow: 1,
  },
  row: {
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    aspectRatio: 0.8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  cardCover: {
    ...StyleSheet.absoluteFillObject,
  },
  cardCoverPlaceholder: {
    backgroundColor: colors.surfaceAlt,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  liveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: colors.pink,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveBadgeLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryBadgeLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  viewerCountBadge: {
    position: 'absolute',
    top: 40,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  viewerCountLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardHost: {
    color: colors.textMuted,
    fontSize: 12,
  },
  cardHashtags: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 6,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
});
