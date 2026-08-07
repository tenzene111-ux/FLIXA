import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import MenuScreen from '../screens/MenuScreen';
import WalletScreen from '../screens/WalletScreen';
import MyPlaylistScreen from '../screens/MyPlaylistScreen';
import DraftsScreen from '../screens/DraftsScreen';

export type ProfileStackParamList = {
  MyProfile: { initialTab?: 'posts' | 'saved' | 'tagged' } | undefined;
  EditProfile: undefined;
  Menu: undefined;
  Wallet: undefined;
  MyPlaylist: undefined;
  Drafts: undefined;
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
    </Stack.Navigator>
  );
}
