import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ExploreScreen from '../screens/ExploreScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import HashtagPageScreen from '../screens/HashtagPageScreen';
import SoundPageScreen from '../screens/SoundPageScreen';

export type ExploreStackParamList = {
  Explore: undefined;
  UserProfile: { uid: string };
  Hashtag: { tag: string };
  Sound: { musicTitle: string };
};

const Stack = createNativeStackNavigator<ExploreStackParamList>();

export default function ExploreStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Explore" component={ExploreScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="Hashtag" component={HashtagPageScreen} />
      <Stack.Screen name="Sound" component={SoundPageScreen} />
    </Stack.Navigator>
  );
}
