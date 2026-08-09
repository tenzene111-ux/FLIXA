import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { NAV_FOOTPRINT } from '../navigation/LiquidTabBar';
import { useAuth } from '../context/AuthContext';
import { deleteDraft, listDrafts } from '../services/drafts';
import type { Draft } from '../types/draft';
import type { ProfileStackParamList } from '../navigation/ProfileStackNavigator';
import type { MainTabParamList } from '../navigation/MainTabNavigator';

export default function DraftsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const load = useCallback(() => {
    if (!user) return;
    listDrafts(user.uid).then(setDrafts);
  }, [user]);

  useFocusEffect(load);

  const handleDelete = (draft: Draft) => {
    if (!user) return;
    Alert.alert('Delete draft', 'This draft will be removed from your device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDraft(user.uid, draft.id);
          load();
        },
      },
    ]);
  };

  const handleContinue = (draft: Draft) => {
    navigation.getParent<BottomTabNavigationProp<MainTabParamList>>()?.navigate('Upload', { draftId: draft.id });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Drafts</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={drafts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + NAV_FOOTPRINT + 16 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={40} color={colors.textDim} />
            <Text style={styles.emptyTitle}>No drafts yet</Text>
            <Text style={styles.emptySubtitle}>Videos saved as drafts from Upload will show up here</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Image source={{ uri: item.thumbnailUri }} style={styles.thumb} />
            <View style={styles.info}>
              <Text style={styles.caption} numberOfLines={2}>
                {item.caption || 'No caption'}
              </Text>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleContinue(item)}>
              <Text style={styles.actionLabel}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
        )}
      />
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
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 24,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
  },
  info: {
    flex: 1,
  },
  caption: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  date: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 6,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
