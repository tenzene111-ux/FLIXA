import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { markNotificationRead, subscribeToNotifications } from '../services/notifications';
import { requestToJoinAsGuest } from '../services/live';
import { getErrorMessage } from '../utils/errors';
import type { Notification } from '../types/notification';
import type { InboxStackParamList } from '../navigation/InboxStackNavigator';
import type { MainTabParamList } from '../navigation/MainTabNavigator';

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
  battle_invite: 'flash',
};

const NOTIFICATION_ICON_COLOR: Record<Notification['type'], string> = {
  like: colors.pink,
  comment: colors.cyan,
  follow: colors.primary,
  battle_invite: colors.pink,
};

function notificationText(notification: Notification): string {
  switch (notification.type) {
    case 'like':
      return 'liked your video';
    case 'comment':
      return `commented: ${notification.commentText}`;
    case 'follow':
      return 'started following you';
    case 'battle_invite':
      return 'challenged you to a LIVE battle';
  }
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<InboxStackParamList>>();
  const { user } = useAuth();
  const profile = useUserProfile(user?.uid);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.uid, setNotifications);
  }, [user]);

  const handleAcceptBattle = (notification: Notification) => {
    if (!user || !profile || !notification.battleStreamId) return;
    requestToJoinAsGuest(notification.battleStreamId, user.uid, profile.username)
      .then(() => {
        navigation
          .getParent<BottomTabNavigationProp<MainTabParamList>>()
          ?.navigate('Home', { screen: 'LiveViewer', params: { streamId: notification.battleStreamId! } });
      })
      .catch((error) => Alert.alert("Couldn't join battle", getErrorMessage(error, 'The stream may have ended.')));
  };

  const handlePress = (notification: Notification) => {
    if (user && !notification.read) {
      markNotificationRead(user.uid, notification.id).catch(() => {});
    }
    if (notification.type === 'battle_invite') {
      Alert.alert('Battle invite', `@${notification.fromUsername} wants to battle live!`, [
        { text: 'Decline', style: 'cancel' },
        { text: 'Accept', onPress: () => handleAcceptBattle(notification) },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Inbox</Text>
        <TouchableOpacity style={styles.messagesButton} onPress={() => navigation.navigate('Messages')} hitSlop={8}>
          <Ionicons name="paper-plane-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

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
  messagesButton: {
    padding: 4,
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
