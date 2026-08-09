import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { NAV_FOOTPRINT } from '../navigation/LiquidTabBar';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { markNotificationRead, subscribeToNotifications } from '../services/notifications';
import { requestToJoinAsGuest } from '../services/live';
import { getErrorMessage } from '../utils/errors';
import NotificationRow from '../components/NotificationRow';
import { ACTIVITY_GROUP_LABEL, ACTIVITY_GROUP_TYPES, type Notification } from '../types/notification';
import type { InboxStackParamList } from '../navigation/InboxStackNavigator';
import type { MainTabParamList } from '../navigation/MainTabNavigator';

export default function ActivityFeedScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<InboxStackParamList>>();
  const route = useRoute<RouteProp<InboxStackParamList, 'ActivityFeed'>>();
  const { user } = useAuth();
  const profile = useUserProfile(user?.uid);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const group = route.params.group;
  const types = ACTIVITY_GROUP_TYPES[group];

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.uid, setNotifications);
  }, [user]);

  const filtered = notifications.filter((n) => types.includes(n.type));

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
    } else if (notification.type === 'went_live' && notification.wentLiveStreamId) {
      navigation
        .getParent<BottomTabNavigationProp<MainTabParamList>>()
        ?.navigate('Home', { screen: 'LiveViewer', params: { streamId: notification.wentLiveStreamId } });
    } else if ((notification.type === 'like' || notification.type === 'comment') && notification.postId) {
      navigation.navigate('SingleVideo', { postId: notification.postId });
    } else if (notification.type === 'follow') {
      navigation.navigate('UserProfile', { uid: notification.fromUid });
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{ACTIVITY_GROUP_LABEL[group]}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + NAV_FOOTPRINT + 16 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={40} color={colors.textDim} />
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
          </View>
        }
        renderItem={({ item }) => <NotificationRow notification={item} onPress={handlePress} />}
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
    paddingHorizontal: 16,
    paddingBottom: 24,
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
