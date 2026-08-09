import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import InboxScreen from '../screens/InboxScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';
import ActivityFeedScreen from '../screens/ActivityFeedScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import CommentsScreen from '../screens/CommentsScreen';
import SingleVideoScreen from '../screens/SingleVideoScreen';
import type { ActivityGroup } from '../types/notification';

export type InboxStackParamList = {
  Notifications: undefined;
  Messages: undefined;
  Chat: { conversationId: string; otherUid: string };
  ActivityFeed: { group: ActivityGroup };
  UserProfile: { uid: string };
  Comments: { postId: string; postOwnerUid: string; postThumbnailUrl: string };
  SingleVideo: { postId: string };
};

const Stack = createNativeStackNavigator<InboxStackParamList>();

export default function InboxStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Notifications" component={InboxScreen} />
      <Stack.Screen name="Messages" component={ConversationsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="ActivityFeed" component={ActivityFeedScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="Comments" component={CommentsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="SingleVideo" component={SingleVideoScreen} options={{ presentation: 'fullScreenModal' }} />
    </Stack.Navigator>
  );
}
