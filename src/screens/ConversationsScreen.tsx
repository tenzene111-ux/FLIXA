import React, { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { NAV_FOOTPRINT } from '../navigation/LiquidTabBar';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { getOtherParticipant, isConversationUnread, subscribeToConversations } from '../services/messages';
import type { Conversation } from '../types/message';
import type { InboxStackParamList } from '../navigation/InboxStackNavigator';

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function ConversationRow({ conversation, myUid }: { conversation: Conversation; myUid: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<InboxStackParamList>>();
  const otherUid = getOtherParticipant(conversation, myUid);
  const otherProfile = useUserProfile(otherUid);
  const unread = isConversationUnread(conversation, myUid);

  if (!otherUid) return null;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('Chat', { conversationId: conversation.id, otherUid })}
    >
      <View style={styles.avatar}>
        {otherProfile?.photoURL ? (
          <Image source={{ uri: otherProfile.photoURL }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarInitial}>{(otherProfile?.username ?? '?').charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowUsername, unread && styles.rowUsernameUnread]}>@{otherProfile?.username ?? '...'}</Text>
        <Text style={[styles.rowMessage, unread && styles.rowMessageUnread]} numberOfLines={1}>
          {conversation.lastMessage || 'Say hello'}
        </Text>
      </View>
      <Text style={styles.rowTime}>{timeAgo(conversation.lastMessageAt)}</Text>
      {unread ? <View style={styles.unreadDot} /> : null}
    </TouchableOpacity>
  );
}

export default function ConversationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<InboxStackParamList>>();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToConversations(user.uid, setConversations);
  }, [user]);

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + NAV_FOOTPRINT + 16 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.textDim} />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>Message a creator from their profile to start a chat</Text>
          </View>
        }
        renderItem={({ item }) => (user ? <ConversationRow conversation={item} myUid={user.uid} /> : null)}
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
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  rowBody: {
    flex: 1,
  },
  rowUsername: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  rowUsernameUnread: {
    color: colors.text,
  },
  rowMessage: {
    color: colors.textMuted,
    fontSize: 13,
  },
  rowMessageUnread: {
    color: colors.text,
    fontWeight: '600',
  },
  rowTime: {
    color: colors.textDim,
    fontSize: 11,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
    marginLeft: 4,
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
