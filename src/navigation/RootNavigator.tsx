import React, { useState } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import LaunchScreen from '../screens/LaunchScreen';
import colors from '../theme/colors';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.border,
    primary: colors.primary,
  },
};

export default function RootNavigator() {
  const { user, initializing } = useAuth();
  const [introDone, setIntroDone] = useState(false);

  // The brand intro always plays its full ~1.3s sequence, and the app
  // only swaps to the real navigator once BOTH that animation has
  // finished AND auth has resolved — whichever takes longer. That way a
  // slow auth check never cuts the intro short, and a fast auth check
  // never leaves the user staring at a blank screen waiting on the
  // animation. The wave background keeps drifting the whole time either
  // way, so there's never a static "loading" moment.
  if (initializing || !introDone) {
    return <LaunchScreen onAnimationDone={() => setIntroDone(true)} />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      {user ? <MainTabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
