import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ExploreScreen from '../screens/ExploreScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import HashtagPageScreen from '../screens/HashtagPageScreen';
import SoundPageScreen from '../screens/SoundPageScreen';
import CommentsScreen from '../screens/CommentsScreen';
import SingleVideoScreen from '../screens/SingleVideoScreen';

export type ExploreStackParamList = {
  Explore: undefined;
  UserProfile: { uid: string };
  Hashtag: { tag: string };
  Sound: { musicTitle: string };
  Comments: { postId: string; postOwnerUid: string; postThumbnailUrl: string };
  SingleVideo: { postId: string };
};

const Stack = createNativeStackNavigator<ExploreStackParamList>();

export default function ExploreStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Explore" component={ExploreScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="Hashtag" component={HashtagPageScreen} />
      <Stack.Screen name="Sound" component={SoundPageScreen} />
      <Stack.Screen name="Comments" component={CommentsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="SingleVideo" component={SingleVideoScreen} options={{ presentation: 'fullScreenModal' }} />
    </Stack.Navigator>
  );
}
