import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { markConversationRead, sendMessage, subscribeToMessages } from '../services/messages';
import type { ChatMessage } from '../types/message';
import type { InboxStackParamList } from '../navigation/InboxStackNavigator';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<InboxStackParamList>>();
  const { params } = useRoute<RouteProp<InboxStackParamList, 'Chat'>>();
  const { user } = useAuth();
  const otherProfile = useUserProfile(params.otherUid);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    return subscribeToMessages(params.conversationId, setMessages);
  }, [params.conversationId]);

  useEffect(() => {
    if (!user) return;
    markConversationRead(params.conversationId, user.uid).catch(() => {});
  }, [params.conversationId, user, messages.length]);

  const handleSend = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    try {
      await sendMessage(params.conversationId, user.uid, text);
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{otherProfile?.username ?? '...'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isMine = item.senderUid === user?.uid;
          if (item.kind === 'post_share') {
            return (
              <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                <TouchableOpacity
                  style={[styles.postShareCard, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
                  onPress={() => item.postId && navigation.navigate('SingleVideo', { postId: item.postId })}
                  disabled={!item.postId}
                  activeOpacity={0.85}
                >
                  {item.postThumbnailUrl ? <Image source={{ uri: item.postThumbnailUrl }} style={styles.postShareThumb} /> : null}
                  <View style={styles.postShareBody}>
                    <View style={styles.postShareTag}>
                      <Ionicons name="videocam" size={11} color={colors.text} />
                      <Text style={styles.postShareTagLabel}>Video</Text>
                    </View>
                    {item.postCaption ? (
                      <Text style={styles.postShareCaption} numberOfLines={2}>
                        {item.postCaption}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </View>
            );
          }
          return (
            <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={styles.bubbleText}>{item.text}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Say hello to @{otherProfile?.username ?? 'them'}</Text>
          </View>
        }
      />

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor={colors.textDim}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity onPress={handleSend} disabled={sending || !text.trim()} hitSlop={8}>
          <Ionicons name="send" size={22} color={text.trim() ? colors.primary : colors.textDim} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    fontSize: 15,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 24,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
  },
  bubbleRow: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: colors.text,
    fontSize: 14,
  },
  postShareCard: {
    width: 160,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 0,
  },
  postShareThumb: {
    width: '100%',
    height: 200,
    backgroundColor: colors.surfaceAlt,
  },
  postShareBody: {
    padding: 10,
    gap: 6,
  },
  postShareTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  postShareTagLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  postShareCaption: {
    color: colors.text,
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    maxHeight: 90,
  },
});
