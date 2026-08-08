import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import type { Notification } from '../types/notification';

export const NOTIFICATION_ICON: Record<Notification['type'], keyof typeof Ionicons.glyphMap> = {
  like: 'heart',
  comment: 'chatbubble-ellipses',
  follow: 'person-add',
  battle_invite: 'flash',
  went_live: 'radio',
};

export const NOTIFICATION_ICON_COLOR: Record<Notification['type'], string> = {
  like: colors.pink,
  comment: colors.cyan,
  follow: colors.primary,
  battle_invite: colors.pink,
  went_live: colors.pink,
};

export function notificationText(notification: Notification): string {
  switch (notification.type) {
    case 'like':
      return 'liked your video';
    case 'comment':
      return `commented: ${notification.commentText}`;
    case 'follow':
      return 'started following you';
    case 'battle_invite':
      return 'challenged you to a LIVE battle';
    case 'went_live':
      return 'is live now';
  }
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

type Props = {
  notification: Notification;
  onPress: (notification: Notification) => void;
};

export default function NotificationRow({ notification, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(notification)} activeOpacity={0.8}>
      <View style={styles.rowIcon}>
        <Ionicons name={NOTIFICATION_ICON[notification.type]} size={16} color={NOTIFICATION_ICON_COLOR[notification.type]} />
      </View>
      <Text style={styles.rowText} numberOfLines={2}>
        <Text style={styles.rowUsername}>@{notification.fromUsername}</Text> {notificationText(notification)}
      </Text>
      <Text style={styles.rowTime}>{timeAgo(notification.createdAt)}</Text>
      {notification.postThumbnailUrl ? <Image source={{ uri: notification.postThumbnailUrl }} style={styles.rowThumb} /> : null}
      {!notification.read ? <View style={styles.unreadDot} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
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
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
