import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import MenuScreen from '../screens/MenuScreen';
import WalletScreen from '../screens/WalletScreen';
import MyPlaylistScreen from '../screens/MyPlaylistScreen';
import DraftsScreen from '../screens/DraftsScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import CommentsScreen from '../screens/CommentsScreen';
import SingleVideoScreen from '../screens/SingleVideoScreen';

export type ProfileStackParamList = {
  MyProfile: { initialTab?: 'posts' | 'saved' | 'tagged' } | undefined;
  EditProfile: undefined;
  Menu: undefined;
  Wallet: undefined;
  MyPlaylist: undefined;
  Drafts: undefined;
  Analytics: undefined;
  UserProfile: { uid: string };
  Comments: { postId: string; postOwnerUid: string; postThumbnailUrl: string };
  SingleVideo: { postId: string };
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyProfile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Menu" component={MenuScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="MyPlaylist" component={MyPlaylistScreen} />
      <Stack.Screen name="Drafts" component={DraftsScreen} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="Comments" component={CommentsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="SingleVideo" component={SingleVideoScreen} options={{ presentation: 'fullScreenModal' }} />
    </Stack.Navigator>
  );
}
