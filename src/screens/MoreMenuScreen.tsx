import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import type { ProfileStackParamList } from '../navigation/ProfileStackNavigator';

const DARK_MODE_STORAGE_KEY = 'flixa-dark-mode-enabled';

type MenuRow = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
};

type Props = NativeStackScreenProps<ProfileStackParamList, 'MoreMenu'>;

export default function MoreMenuScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(DARK_MODE_STORAGE_KEY).then((stored) => {
      if (stored !== null) setDarkMode(stored === 'true');
    });
  }, []);

  const toggleDarkMode = (value: boolean) => {
    setDarkMode(value);
    AsyncStorage.setItem(DARK_MODE_STORAGE_KEY, String(value));
  };

  const rows: MenuRow[] = [
    { icon: 'person-outline', label: 'My Profile', onPress: () => navigation.navigate('Profile') },
    { icon: 'construct-outline', label: 'Creator Tools' },
    { icon: 'wallet-outline', label: 'Wallet', onPress: () => navigation.navigate('Wallet') },
    { icon: 'qr-code-outline', label: 'My QR Code' },
    { icon: 'bookmark-outline', label: 'Saved Videos', onPress: () => navigation.navigate('MyPlaylist') },
    { icon: 'document-text-outline', label: 'Drafts' },
    { icon: 'time-outline', label: 'History' },
    { icon: 'settings-outline', label: 'Settings' },
    { icon: 'shield-checkmark-outline', label: 'Privacy Center' },
    { icon: 'help-circle-outline', label: 'Help & Feedback' },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerAction}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>More</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {rows.map((row) => (
          <TouchableOpacity key={row.label} style={styles.row} onPress={row.onPress} disabled={!row.onPress}>
            <Ionicons name={row.icon} size={20} color={colors.text} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </TouchableOpacity>
        ))}

        <View style={styles.row}>
          <Ionicons name="moon-outline" size={20} color={colors.text} style={styles.rowIcon} />
          <Text style={styles.rowLabel}>Dark Mode</Text>
          <Switch
            value={darkMode}
            onValueChange={toggleDarkMode}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.text}
          />
        </View>

        <TouchableOpacity style={styles.row} onPress={signOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} style={styles.rowIcon} />
          <Text style={[styles.rowLabel, { color: colors.danger }]}>Log Out</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerAction: {
    padding: 4,
    width: 32,
  },
  headerSpacer: {
    width: 32,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    marginRight: 16,
  },
  rowLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
});
