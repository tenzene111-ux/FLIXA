import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useUnreadInboxCount } from '../hooks/useUnreadInboxCount';

type IconSet = { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap };

// Home/Explore/Inbox/Profile are the four "liquid" slots the active bubble
// glides between. Upload/Create sits in the same row, same alignment, just
// rendered as a slightly larger permanent gradient orb instead of joining
// the sliding indicator — so it stays unmistakably the record button.
const ICONS: Record<string, IconSet> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Explore: { active: 'search', inactive: 'search-outline' },
  Inbox: { active: 'chatbubble', inactive: 'chatbubble-outline' },
  Profile: { active: 'person-circle', inactive: 'person-circle-outline' },
};

const BAR_HEIGHT = 64;
const BAR_RADIUS = 32;
const BAR_MARGIN = 18;
const BUBBLE_SIZE = 46;
const ORB_SIZE = 48;
const BOTTOM_GAP = 14;

// How tall the floating pill is from the true screen bottom, not counting
// the safe-area inset — full-bleed screens behind it (VideoCard, LIVE
// screens) need this to keep their own bottom content from sitting
// underneath the pill, since it's an overlay rather than a layout-
// reserving bar.
export const NAV_FOOTPRINT = BOTTOM_GAP + BAR_HEIGHT;

export default function LiquidTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadInboxCount();
  const [barWidth, setBarWidth] = useState(0);

  const activeIndex = state.index;
  const activeRoute = state.routes[activeIndex];
  const isCreateActive = activeRoute.name === 'Upload';
  const createRoute = state.routes.find((r) => r.name === 'Upload')!;

  const bubbleX = useRef(new Animated.Value(0)).current;
  const bubbleScale = useRef(new Animated.Value(1)).current;
  const bubbleOpacity = useRef(new Animated.Value(isCreateActive ? 0 : 1)).current;
  const orbGlow = useRef(new Animated.Value(0)).current;
  const iconScales = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(
      state.routes.map((r) => [r.key, new Animated.Value(r.name === activeRoute.name && r.name !== 'Upload' ? 1.08 : 1)])
    )
  ).current;

  // Slide + morph the liquid bubble to the newly focused tab — a quick
  // squeeze-and-release "dissolve" on scale/opacity layered under a spring
  // slide, rather than a flat horizontal translate.
  useEffect(() => {
    if (barWidth === 0) return;
    const slotWidth = barWidth / state.routes.length;
    const targetX = activeIndex * slotWidth + slotWidth / 2 - BUBBLE_SIZE / 2;

    Animated.timing(bubbleX, {
      toValue: targetX,
      duration: 380,
      easing: Easing.out(Easing.back(1.15)),
      useNativeDriver: true,
    }).start();

    Animated.sequence([
      Animated.timing(bubbleScale, { toValue: 0.7, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(bubbleScale, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.timing(bubbleOpacity, { toValue: isCreateActive ? 0 : 0.35, duration: 130, useNativeDriver: true }),
      Animated.timing(bubbleOpacity, { toValue: isCreateActive ? 0 : 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [activeIndex, barWidth]);

  useEffect(() => {
    state.routes.forEach((r) => {
      const focused = r.name === activeRoute.name && r.name !== 'Upload';
      Animated.spring(iconScales[r.key], {
        toValue: focused ? 1.08 : 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }).start();
    });
  }, [activeIndex]);

  // Very subtle always-on breathing glow behind the Create orb.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbGlow, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(orbGlow, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const handleBarLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  const onCreatePress = () => {
    const event = navigation.emit({ type: 'tabPress', target: createRoute.key, canPreventDefault: true });
    if (!isCreateActive && !event.defaultPrevented) navigation.navigate(createRoute.name, createRoute.params);
  };
  const onCreateLongPress = () => navigation.emit({ type: 'tabLongPress', target: createRoute.key });

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
      <View style={[styles.shadowLayer, { bottom: insets.bottom + BOTTOM_GAP, marginHorizontal: BAR_MARGIN }]}>
        <View style={styles.glassLayer} onLayout={handleBarLayout}>
          <LinearGradient
            colors={['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.01)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <View style={styles.topHighlight} />

          <Animated.View
            pointerEvents="none"
            style={[
              styles.bubble,
              { opacity: bubbleOpacity, transform: [{ translateX: bubbleX }, { scale: bubbleScale }] },
            ]}
          >
            <LinearGradient
              colors={colors.gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bubbleGradient}
            />
            <View style={styles.bubbleHighlight} />
          </Animated.View>

          <View style={styles.row}>
            {state.routes.map((route, index) => {
              if (route.name === 'Upload') {
                return (
                  <Pressable
                    key={route.key}
                    onPress={onCreatePress}
                    onLongPress={onCreateLongPress}
                    style={styles.slot}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isCreateActive }}
                  >
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.orbGlow,
                        {
                          opacity: orbGlow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] }),
                          transform: [{ scale: orbGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }],
                        },
                      ]}
                    />
                    <LinearGradient colors={colors.gradientButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.orb}>
                      <View style={styles.orbEdge} />
                      <Ionicons name="add" size={24} color={colors.text} />
                    </LinearGradient>
                  </Pressable>
                );
              }
              const focused = index === activeIndex;
              const icons = ICONS[route.name];
              const onPress = () => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              };
              const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

              return (
                <Pressable
                  key={route.key}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={styles.slot}
                  android_ripple={{ color: 'rgba(122,60,255,0.28)', borderless: true, radius: 30 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: focused }}
                >
                  <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScales[route.key] }] }]}>
                    <Ionicons
                      name={focused ? icons.active : icons.inactive}
                      size={24}
                      color={focused ? colors.text : 'rgba(247,247,250,0.45)'}
                    />
                    {route.name === 'Inbox' && unreadCount > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeLabel} numberOfLines={1}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Text>
                      </View>
                    ) : null}
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  glassLayer: {
    flex: 1,
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
    backgroundColor: 'rgba(9,9,18,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: BAR_RADIUS * 0.6,
    right: BAR_RADIUS * 0.6,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    position: 'absolute',
    top: (BAR_HEIGHT - BUBBLE_SIZE) / 2,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    overflow: 'hidden',
  },
  bubbleGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.32,
  },
  bubbleHighlight: {
    position: 'absolute',
    top: 3,
    left: 6,
    right: 6,
    height: BUBBLE_SIZE * 0.32,
    borderRadius: BUBBLE_SIZE,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(9,9,18,0.8)',
  },
  badgeLabel: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '700',
  },
  orbGlow: {
    position: 'absolute',
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: colors.purple,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.magenta,
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  orbEdge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ORB_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
