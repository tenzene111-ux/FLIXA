import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import HomeScreen from '../screens/HomeScreen';
import UploadScreen from '../screens/UploadScreen';
import InboxScreen from '../screens/InboxScreen';
import DiscoverStackNavigator from './DiscoverStackNavigator';
import ProfileStackNavigator from './ProfileStackNavigator';
import colors from '../theme/colors';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Discover: 'search',
  Inbox: 'chatbubble-ellipses',
  Profile: 'person',
};

const NESTED_ROOT_ROUTE: Record<string, string> = {
  Discover: 'Explore',
  Profile: 'Profile',
};

const tabBarVisibleStyle = {
  backgroundColor: colors.surface,
  borderTopColor: colors.border,
  height: 60,
};

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const rootRouteName = NESTED_ROOT_ROUTE[route.name];
        const focusedNestedRoute = rootRouteName ? getFocusedRouteNameFromRoute(route) ?? rootRouteName : undefined;
        const hideTabBar = rootRouteName !== undefined && focusedNestedRoute !== rootRouteName;

        return {
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.textDim,
          tabBarStyle: hideTabBar ? { display: 'none' } : tabBarVisibleStyle,
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
                    <Ionicons name="add" size={28} color={colors.text} />
                  </LinearGradient>
                </View>
              );
            }
            return <Ionicons name={TAB_ICONS[route.name]} size={26} color={focused ? colors.text : color} />;
          },
        };
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Discover" component={DiscoverStackNavigator} />
      <Tab.Screen name="Upload" component={UploadScreen} />
      <Tab.Screen name="Inbox" component={InboxScreen} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  centerButtonWrap: {
    top: -18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.pink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
});
