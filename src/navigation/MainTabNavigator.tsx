import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import HomeStackNavigator, { type HomeStackParamList } from './HomeStackNavigator';
import ExploreStackNavigator from './ExploreStackNavigator';
import UploadScreen from '../screens/UploadScreen';
import InboxStackNavigator from './InboxStackNavigator';
import ProfileStackNavigator from './ProfileStackNavigator';
import colors from '../theme/colors';

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Explore: undefined;
  Upload: { draftId?: string } | undefined;
  Inbox: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Explore: 'search',
  Inbox: 'chatbubble-ellipses',
  Profile: 'person',
};

const BASE_BAR_HEIGHT = 56;

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: BASE_BAR_HEIGHT + insets.bottom,
          paddingTop: 10,
          paddingBottom: insets.bottom + 6,
        },
        tabBarIcon: ({ color, focused }) => {
          if (route.name === 'Upload') {
            return (
              <View style={styles.centerButtonWrap}>
                <LinearGradient
                  colors={colors.gradientButton}
                  style={styles.centerButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="add" size={22} color={colors.text} />
                </LinearGradient>
              </View>
            );
          }
          return (
            <Ionicons
              name={TAB_ICONS[route.name]}
              size={25}
              color={focused ? colors.text : color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="Explore" component={ExploreStackNavigator} />
      <Tab.Screen name="Upload" component={UploadScreen} />
      <Tab.Screen name="Inbox" component={InboxStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  centerButtonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
