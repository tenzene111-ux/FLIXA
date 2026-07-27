import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/ProfileScreen';
import MoreMenuScreen from '../screens/MoreMenuScreen';
import WalletScreen from '../screens/WalletScreen';
import MyPlaylistScreen from '../screens/MyPlaylistScreen';

export type ProfileStackParamList = {
  Profile: undefined;
  MoreMenu: undefined;
  Wallet: undefined;
  MyPlaylist: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="MoreMenu" component={MoreMenuScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="MyPlaylist" component={MyPlaylistScreen} />
    </Stack.Navigator>
  );
}
