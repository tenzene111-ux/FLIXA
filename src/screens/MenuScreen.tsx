import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { NAV_FOOTPRINT } from '../navigation/LiquidTabBar';
import type { ProfileStackParamList } from '../navigation/ProfileStackNavigator';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: (navigation: NativeStackNavigationProp<ProfileStackParamList>) => void;
};

const ITEMS: MenuItem[] = [
  { icon: 'person-outline', label: 'My Profile', onPress: (nav) => nav.goBack() },
  { icon: 'bar-chart-outline', label: 'Analytics', onPress: (nav) => nav.navigate('Analytics') },
  { icon: 'wallet-outline', label: 'Wallet', onPress: (nav) => nav.navigate('Wallet') },
  { icon: 'albums-outline', label: 'My Playlists', onPress: (nav) => nav.navigate('MyPlaylist') },
  { icon: 'qr-code-outline', label: 'My QR Code', onPress: () => Alert.alert('My QR Code', 'Coming soon') },
  {
    icon: 'bookmark-outline',
    label: 'Saved Videos',
    onPress: (nav) => nav.navigate('MyProfile', { initialTab: 'saved' }),
  },
  { icon: 'document-text-outline', label: 'Drafts', onPress: (nav) => nav.navigate('Drafts') },
  { icon: 'time-outline', label: 'History', onPress: () => Alert.alert('History', 'Coming soon') },
  { icon: 'settings-outline', label: 'Settings', onPress: () => Alert.alert('Settings', 'Coming soon') },
  { icon: 'shield-checkmark-outline', label: 'Privacy Center', onPress: () => Alert.alert('Privacy Center', 'Coming soon') },
  { icon: 'help-circle-outline', label: 'Help & Feedback', onPress: () => Alert.alert('Help & Feedback', 'Coming soon') },
];

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { signOut } = useAuth();
  const [darkMode, setDarkMode] = useState(true);

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Menu</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + NAV_FOOTPRINT + 24 }]}>
        {ITEMS.map((item) => (
          <TouchableOpacity key={item.label} style={styles.row} onPress={() => item.onPress(navigation)}>
            <Ionicons name={item.icon} size={20} color={colors.text} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </TouchableOpacity>
        ))}

        <View style={styles.row}>
          <Ionicons name="moon-outline" size={20} color={colors.text} style={styles.rowIcon} />
          <Text style={styles.rowLabel}>Dark Mode</Text>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.text}
          />
        </View>

        <TouchableOpacity style={styles.row} onPress={signOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} style={styles.rowIcon} />
          <Text style={[styles.rowLabel, styles.logOutLabel]}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 24,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 14,
  },
  rowIcon: {
    width: 22,
  },
  rowLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  logOutLabel: {
    color: colors.danger,
  },
});
