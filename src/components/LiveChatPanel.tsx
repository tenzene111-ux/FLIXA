import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import {
  blockUserFromChat,
  deleteLiveComment,
  sendLiveComment,
  unblockUserFromChat,
  addModerator,
  removeModerator,
} from '../services/live';
import type { LiveComment } from '../types/liveStream';

type Props = {
  streamId: string;
  myUid: string | undefined;
  myUsername: string | undefined;
  comments: LiveComment[];
  allowComments: boolean;
  canModerate: boolean;
  canManageModerators: boolean;
  moderatorUids: Set<string>;
  blockedUids: Set<string>;
  iAmBlocked: boolean;
  bottomInset: number;
};

export default function LiveChatPanel({
  streamId,
  myUid,
  myUsername,
  comments,
  allowComments,
  canModerate,
  canManageModerators,
  moderatorUids,
  blockedUids,
  iAmBlocked,
  bottomInset,
}: Props) {
  const [chatText, setChatText] = useState('');
  const [actionTarget, setActionTarget] = useState<LiveComment | null>(null);

  const handleSend = () => {
    if (!myUid || !myUsername || !chatText.trim()) return;
    sendLiveComment(streamId, myUid, myUsername, chatText).catch(() => {});
    setChatText('');
  };

  const handleLongPress = (comment: LiveComment) => {
    if (!canModerate && comment.uid !== myUid) return;
    setActionTarget(comment);
  };

  const handleDeleteMessage = () => {
    if (!actionTarget) return;
    deleteLiveComment(streamId, actionTarget.id).catch(() => {});
    setActionTarget(null);
  };

  const handleToggleModerator = () => {
    if (!actionTarget) return;
    const action = moderatorUids.has(actionTarget.uid)
      ? removeModerator(streamId, actionTarget.uid)
      : addModerator(streamId, actionTarget.uid, actionTarget.username);
    action.catch(() => {});
    setActionTarget(null);
  };

  const handleToggleBlock = () => {
    if (!actionTarget) return;
    const action = blockedUids.has(actionTarget.uid)
      ? unblockUserFromChat(streamId, actionTarget.uid)
      : blockUserFromChat(streamId, actionTarget.uid, actionTarget.username);
    action.catch(() => {});
    setActionTarget(null);
  };

  if (!allowComments) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.chatWrap, { paddingBottom: bottomInset + 12 }]}
    >
      <FlatList
        data={comments.slice(-30)}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => handleLongPress(item)}
            disabled={!canModerate && item.uid !== myUid}
          >
            <Text style={styles.chatLine}>
              <Text style={styles.chatUsername}>
                {moderatorUids.has(item.uid) ? '🛡 ' : ''}
                {item.username}:{' '}
              </Text>
              {item.text}
            </Text>
          </Pressable>
        )}
        style={styles.chatList}
      />
      {iAmBlocked ? (
        <Text style={styles.blockedNotice}>You've been blocked from chatting in this stream.</Text>
      ) : (
        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInput}
            placeholder="Say something..."
            placeholderTextColor={colors.textDim}
            value={chatText}
            onChangeText={setChatText}
          />
          <TouchableOpacity onPress={handleSend} hitSlop={8}>
            <Ionicons name="send" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={!!actionTarget} transparent animationType="fade" onRequestClose={() => setActionTarget(null)}>
        <Pressable style={styles.actionBackdrop} onPress={() => setActionTarget(null)}>
          <View style={styles.actionSheet}>
            <Text style={styles.actionTitle} numberOfLines={1}>
              {actionTarget?.username}
            </Text>
            {canModerate || actionTarget?.uid === myUid ? (
              <TouchableOpacity style={styles.actionRow} onPress={handleDeleteMessage}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={[styles.actionLabel, styles.actionDanger]}>Delete message</Text>
              </TouchableOpacity>
            ) : null}
            {canManageModerators && actionTarget && actionTarget.uid !== myUid ? (
              <TouchableOpacity style={styles.actionRow} onPress={handleToggleModerator}>
                <Ionicons name="shield-outline" size={18} color={colors.text} />
                <Text style={styles.actionLabel}>
                  {moderatorUids.has(actionTarget.uid) ? 'Remove moderator' : 'Make moderator'}
                </Text>
              </TouchableOpacity>
            ) : null}
            {canModerate && actionTarget && actionTarget.uid !== myUid ? (
              <TouchableOpacity style={styles.actionRow} onPress={handleToggleBlock}>
                <Ionicons name="ban-outline" size={18} color={colors.text} />
                <Text style={styles.actionLabel}>
                  {blockedUids.has(actionTarget.uid) ? 'Unblock from chat' : 'Block from chat'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chatWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '40%',
    paddingRight: 70,
  },
  chatList: {
    paddingHorizontal: 16,
  },
  chatLine: {
    color: colors.text,
    fontSize: 13,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  chatUsername: {
    fontWeight: '700',
  },
  blockedNotice: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  chatInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  actionBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  actionSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 28,
    gap: 4,
  },
  actionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  actionDanger: {
    color: colors.danger,
  },
});
