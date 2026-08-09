import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import InboxScreen from '../screens/InboxScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';
import ActivityFeedScreen from '../screens/ActivityFeedScreen';
import type { ActivityGroup } from '../types/notification';

export type InboxStackParamList = {
  Notifications: undefined;
  Messages: undefined;
  Chat: { conversationId: string; otherUid: string };
  ActivityFeed: { group: ActivityGroup };
};

const Stack = createNativeStackNavigator<InboxStackParamList>();

export default function InboxStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Notifications" component={InboxScreen} />
      <Stack.Screen name="Messages" component={ConversationsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="ActivityFeed" component={ActivityFeedScreen} />
    </Stack.Navigator>
  );
}
