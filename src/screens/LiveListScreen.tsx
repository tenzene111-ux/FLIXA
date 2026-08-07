import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { subscribeToLiveStreams } from '../services/live';
import type { LiveStream } from '../types/liveStream';
import type { HomeStackParamList } from '../navigation/HomeStackNavigator';

export default function LiveListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [streams, setStreams] = useState<LiveStream[]>([]);

  useEffect(() => subscribeToLiveStreams(setStreams), []);

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Now</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={streams}
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
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeLabel}>LIVE</Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.cardHost} numberOfLines={1}>
              @{item.hostUsername}
            </Text>
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
    aspectRatio: 1,
    justifyContent: 'flex-end',
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
