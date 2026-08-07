import React, { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { markNotificationRead, subscribeToNotifications } from '../services/notifications';
import type { Notification } from '../types/notification';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const NOTIFICATION_ICON: Record<Notification['type'], keyof typeof Ionicons.glyphMap> = {
  like: 'heart',
  comment: 'chatbubble-ellipses',
  follow: 'person-add',
};

const NOTIFICATION_ICON_COLOR: Record<Notification['type'], string> = {
  like: colors.pink,
  comment: colors.cyan,
  follow: colors.primary,
};

function notificationText(notification: Notification): string {
  switch (notification.type) {
    case 'like':
      return 'liked your video';
    case 'comment':
      return `commented: ${notification.commentText}`;
    case 'follow':
      return 'started following you';
  }
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.uid, setNotifications);
  }, [user]);

  const handlePress = (notification: Notification) => {
    if (!user || notification.read) return;
    markNotificationRead(user.uid, notification.id).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { paddingTop: insets.top + 8 }]}>Inbox</Text>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={40} color={colors.textDim} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>Likes, comments, and new followers show up here</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, !item.read && styles.rowUnread]}
            onPress={() => handlePress(item)}
            activeOpacity={0.8}
          >
            <View style={styles.rowIcon}>
              <Ionicons name={NOTIFICATION_ICON[item.type]} size={16} color={NOTIFICATION_ICON_COLOR[item.type]} />
            </View>
            <Text style={styles.rowText} numberOfLines={2}>
              <Text style={styles.rowUsername}>@{item.fromUsername}</Text> {notificationText(item)}
            </Text>
            <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
            {item.postThumbnailUrl ? <Image source={{ uri: item.postThumbnailUrl }} style={styles.rowThumb} /> : null}
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
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  rowUnread: {
    opacity: 1,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  rowUsername: {
    fontWeight: '700',
  },
  rowTime: {
    color: colors.textDim,
    fontSize: 11,
  },
  rowThumb: {
    width: 40,
    height: 52,
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt,
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
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
