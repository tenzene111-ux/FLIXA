import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { subscribeNotifications } from '../services/notifications';
import type { NotificationItem, NotificationType } from '../types/models';
import { formatRelativeTime } from '../utils/format';

type TabKey = 'all' | NotificationType;

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'apps-outline' },
  { key: 'like', label: 'Likes', icon: 'heart-outline' },
  { key: 'comment', label: 'Comments', icon: 'chatbubble-outline' },
  { key: 'follow', label: 'Follows', icon: 'person-add-outline' },
  { key: 'system', label: 'System', icon: 'notifications-outline' },
];

const TYPE_ICON: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  like: 'heart',
  comment: 'chatbubble',
  follow: 'person-add',
  system: 'megaphone',
};

const TYPE_COLOR: Record<NotificationType, string> = {
  like: colors.pink,
  comment: colors.cyan,
  follow: colors.primary,
  system: colors.textMuted,
};

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  useEffect(() => {
    if (!user) return;
    return subscribeNotifications(user.uid, setItems);
  }, [user]);

  const filtered = useMemo(
    () => (activeTab === 'all' ? items : items.filter((item) => item.type === activeTab)),
    [items, activeTab]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Inbox</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.textDim} />
        <TextInput placeholder="Search" placeholderTextColor={colors.textDim} style={styles.searchInput} />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <TouchableOpacity key={tab.key} style={styles.tabItem} onPress={() => setActiveTab(tab.key)}>
              <Ionicons name={tab.icon} size={20} color={active ? colors.text : colors.textMuted} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.avatarWrap}>
              <Image source={{ uri: item.fromAvatar }} style={styles.avatar} />
              <View style={[styles.typeBadge, { backgroundColor: TYPE_COLOR[item.type] }]}>
                <Ionicons name={TYPE_ICON[item.type]} size={9} color={colors.text} />
              </View>
            </View>
            <View style={styles.info}>
              <Text style={styles.message}>
                <Text style={styles.fromName}>{item.fromName} </Text>
                {item.message}
              </Text>
              <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
            </View>
            {item.type === 'follow' && (
              <TouchableOpacity style={styles.followBackButton}>
                <Text style={styles.followBackLabel}>Follow back</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>You're all caught up.</Text>}
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
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  tabItem: {
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  message: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  fromName: {
    fontWeight: '700',
  },
  time: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  followBackButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  followBackLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 40,
  },
});
