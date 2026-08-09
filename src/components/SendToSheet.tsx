import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useUserProfile } from '../hooks/useUserProfile';
import { getOtherParticipant, sendPostShare, subscribeToConversations } from '../services/messages';
import type { Conversation } from '../types/message';

type SharePost = { id: string; thumbnailUrl: string; caption: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  post: SharePost;
  senderUid: string;
};

function RecipientRow({
  conversation,
  senderUid,
  selected,
  onToggle,
}: {
  conversation: Conversation;
  senderUid: string;
  selected: boolean;
  onToggle: (conversationId: string) => void;
}) {
  const otherUid = getOtherParticipant(conversation, senderUid);
  const profile = useUserProfile(otherUid);
  if (!otherUid) return null;

  return (
    <TouchableOpacity style={styles.row} onPress={() => onToggle(conversation.id)} activeOpacity={0.8}>
      <View style={styles.avatar}>
        {profile?.photoURL ? (
          <Image source={{ uri: profile.photoURL }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarInitial}>{(profile?.username ?? '?').charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <Text style={styles.rowUsername}>@{profile?.username ?? '...'}</Text>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? colors.primary : colors.textDim}
      />
    </TouchableOpacity>
  );
}

export default function SendToSheet({ visible, onClose, post, senderUid }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!visible) return;
    return subscribeToConversations(senderUid, setConversations);
  }, [visible, senderUid]);

  useEffect(() => {
    if (!visible) {
      setSelectedIds([]);
      setSent(false);
    }
  }, [visible]);

  const handleToggle = (conversationId: string) => {
    setSelectedIds((prev) => (prev.includes(conversationId) ? prev.filter((id) => id !== conversationId) : [...prev, conversationId]));
  };

  const handleSend = async () => {
    if (selectedIds.length === 0) return;
    setSending(true);
    try {
      await Promise.all(selectedIds.map((conversationId) => sendPostShare(conversationId, senderUid, post)));
      setSent(true);
      setTimeout(onClose, 700);
    } finally {
      setSending(false);
    }
  };

  const selectedCount = useMemo(() => selectedIds.length, [selectedIds]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Send to</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>

          {sent ? (
            <View style={styles.sentState}>
              <Ionicons name="checkmark-circle" size={40} color={colors.primary} />
              <Text style={styles.sentLabel}>Sent!</Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={34} color={colors.textDim} />
                  <Text style={styles.emptyTitle}>No conversations yet</Text>
                  <Text style={styles.emptySubtitle}>Message someone from their profile first, then you can send them videos here</Text>
                </View>
              }
              renderItem={({ item }) => (
                <RecipientRow conversation={item} senderUid={senderUid} selected={selectedIds.includes(item.id)} onToggle={handleToggle} />
              )}
            />
          )}

          {!sent && conversations.length > 0 ? (
            <TouchableOpacity
              style={[styles.sendButton, selectedCount === 0 && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={selectedCount === 0 || sending}
            >
              {sending ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Text style={styles.sendButtonLabel}>{selectedCount > 0 ? `Send (${selectedCount})` : 'Send'}</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  close: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 14,
    fontWeight: '700',
  },
  rowUsername: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 6,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  sentState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  sentLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sendButton: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
