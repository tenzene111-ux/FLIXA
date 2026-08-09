import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { markAllNotificationsRead, subscribeToNotifications } from '../services/notifications';
import { subscribeToConversations } from '../services/messages';
import { ConversationRow } from './ConversationsScreen';
import { NOTIFICATION_ICON, NOTIFICATION_ICON_COLOR, notificationText, timeAgo } from '../components/NotificationRow';
import { ACTIVITY_GROUP_LABEL, ACTIVITY_GROUP_ORDER, ACTIVITY_GROUP_TYPES, type ActivityGroup, type Notification } from '../types/notification';
import type { Conversation } from '../types/message';
import type { InboxStackParamList } from '../navigation/InboxStackNavigator';

const MESSAGE_PREVIEW_COUNT = 3;

function ActivityRow({ group, notifications, onPress }: { group: ActivityGroup; notifications: Notification[]; onPress: () => void }) {
  const types = ACTIVITY_GROUP_TYPES[group];
  const filtered = notifications.filter((n) => types.includes(n.type));
  const latest = filtered[0];
  const unreadCount = filtered.filter((n) => !n.read).length;

  return (
    <TouchableOpacity style={styles.activityRow} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.activityIconWrap}>
        <View style={styles.activityIcon}>
          <Ionicons
            name={latest ? NOTIFICATION_ICON[latest.type] : NOTIFICATION_ICON[types[0]]}
            size={17}
            color={latest ? NOTIFICATION_ICON_COLOR[latest.type] : NOTIFICATION_ICON_COLOR[types[0]]}
          />
        </View>
        {unreadCount > 0 ? (
          <View style={styles.activityBadge}>
            <Text style={styles.activityBadgeLabel}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.activityBody}>
        <Text style={styles.activityLabel}>{ACTIVITY_GROUP_LABEL[group]}</Text>
        <Text style={styles.activityPreview} numberOfLines={1}>
          {latest ? `@${latest.fromUsername} ${notificationText(latest)}` : 'Nothing yet'}
        </Text>
      </View>
      {latest ? <Text style={styles.activityTime}>{timeAgo(latest.createdAt)}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
    </TouchableOpacity>
  );
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<InboxStackParamList>>();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.uid, setNotifications);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToConversations(user.uid, setConversations);
  }, [user]);

  const hasUnread = useMemo(() => notifications.some((n) => !n.read), [notifications]);

  const handleMarkAllRead = () => {
    if (user) markAllNotificationsRead(user.uid).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Inbox</Text>
        <View style={styles.headerActions}>
          {hasUnread ? (
            <TouchableOpacity style={styles.headerIconButton} onPress={handleMarkAllRead} hitSlop={8}>
              <Ionicons name="checkmark-done-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.headerIconButton} onPress={() => navigation.navigate('Messages')} hitSlop={8}>
            <Ionicons name="paper-plane-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {ACTIVITY_GROUP_ORDER.map((group) => (
          <ActivityRow
            key={group}
            group={group}
            notifications={notifications}
            onPress={() => navigation.navigate('ActivityFeed', { group })}
          />
        ))}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Messages</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Messages')} hitSlop={8}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {conversations.length === 0 ? (
          <View style={styles.emptyMessages}>
            <Ionicons name="chatbubbles-outline" size={34} color={colors.textDim} />
            <Text style={styles.emptyMessagesTitle}>No messages yet</Text>
            <Text style={styles.emptyMessagesSubtitle}>Message a creator from their profile to start a chat</Text>
          </View>
        ) : (
          user &&
          conversations
            .slice(0, MESSAGE_PREVIEW_COUNT)
            .map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} myUid={user.uid} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIconButton: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  activityIconWrap: {
    position: 'relative',
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBadgeLabel: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '800',
  },
  activityBody: {
    flex: 1,
  },
  activityLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  activityPreview: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  activityTime: {
    color: colors.textDim,
    fontSize: 11,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  seeAll: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyMessages: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  emptyMessagesTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyMessagesSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
