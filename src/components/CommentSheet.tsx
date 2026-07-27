import React, { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { addComment, subscribeComments } from '../services/videos';
import type { VideoComment } from '../types/models';

type Props = {
  videoId: string;
  visible: boolean;
  onClose: () => void;
};

export default function CommentSheet({ videoId, visible, onClose }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!visible) return;
    return subscribeComments(videoId, setComments);
  }, [visible, videoId]);

  const handleSend = () => {
    if (!user || !draft.trim()) return;
    const username = user.email ? `@${user.email.split('@')[0]}` : '@you';
    addComment(videoId, user.uid, username, draft.trim());
    setDraft('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTap} onPress={onClose} activeOpacity={1} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
          <View style={styles.handleBar} />
          <Text style={styles.title}>Comments</Text>
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            style={styles.list}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.rowUser}>{item.username}</Text>
                <Text style={styles.rowText}>{item.text}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No comments yet. Say something!</Text>}
          />
          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment..."
              placeholderTextColor={colors.textDim}
              style={styles.input}
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity onPress={handleSend} disabled={!draft.trim()}>
              <Ionicons name="send" size={20} color={draft.trim() ? colors.pink : colors.textDim} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 10,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  list: {
    maxHeight: 320,
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowUser: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  rowText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  empty: {
    color: colors.textDim,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
});
