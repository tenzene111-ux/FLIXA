import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import CommentsScreen from '../screens/CommentsScreen';
import LiveListScreen from '../screens/LiveListScreen';
import LiveHostScreen from '../screens/LiveHostScreen';
import LiveViewerScreen from '../screens/LiveViewerScreen';

export type HomeStackParamList = {
  Feed: undefined;
  UserProfile: { uid: string };
  Comments: { postId: string; postOwnerUid: string; postThumbnailUrl: string };
  LiveList: undefined;
  LiveHost: undefined;
  LiveViewer: { streamId: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Feed" component={HomeScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="Comments" component={CommentsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="LiveList" component={LiveListScreen} />
      <Stack.Screen name="LiveHost" component={LiveHostScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="LiveViewer" component={LiveViewerScreen} options={{ presentation: 'fullScreenModal' }} />
    </Stack.Navigator>
  );
}
