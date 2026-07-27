import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { subscribeActiveLiveStream, subscribeLiveComments, postLiveComment } from '../services/live';
import { spendCoins } from '../services/wallet';
import type { DiscoverStackParamList } from '../navigation/DiscoverStackNavigator';
import type { LiveComment, LiveStream } from '../types/models';
import { formatCompactNumber } from '../utils/format';

type Props = NativeStackScreenProps<DiscoverStackParamList, 'Live'>;

export default function LiveScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [draft, setDraft] = useState('');
  const [following, setFollowing] = useState(false);
  const [sendingGift, setSendingGift] = useState(false);

  useEffect(() => subscribeActiveLiveStream(setStream), []);
  useEffect(() => {
    if (!stream) return;
    return subscribeLiveComments(stream.id, setComments);
  }, [stream?.id]);

  const handleSend = () => {
    if (!stream || !draft.trim() || !user) return;
    postLiveComment(stream.id, user.email?.split('@')[0] ?? 'You', draft.trim());
    setDraft('');
  };

  const handleGift = async () => {
    setSendingGift(true);
    try {
      await spendCoins({ item: 'live_gift' });
    } catch (err: any) {
      Alert.alert('Gift failed', err?.message ?? 'Not enough coins.');
    } finally {
      setSendingGift(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeLabel}>LIVE</Text>
        </View>
        <View style={styles.viewerBadge}>
          <Ionicons name="eye" size={13} color={colors.text} />
          <Text style={styles.viewerBadgeLabel}>{formatCompactNumber(stream?.viewerCount ?? 0)}</Text>
        </View>
      </View>

      {!stream && (
        <View style={styles.placeholder}>
          <Ionicons name="videocam-outline" size={40} color={colors.textDim} />
          <Text style={styles.placeholderText}>No one is live right now</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottomArea}
      >
        {stream && (
          <View style={styles.hostRow}>
            <Image source={{ uri: stream.hostAvatar }} style={styles.hostAvatar} />
            <Text style={styles.hostName}>{stream.hostName}</Text>
            <TouchableOpacity
              style={[styles.followButton, following && styles.followButtonActive]}
              onPress={() => setFollowing(true)}
              disabled={following}
            >
              <Text style={styles.followLabel}>{following ? 'Following' : 'Follow'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          style={styles.commentList}
          renderItem={({ item }) => (
            <Text style={styles.commentRow}>
              <Text style={styles.commentUser}>{item.userName} </Text>
              {item.text}
            </Text>
          )}
          inverted={false}
        />

        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textDim}
            style={styles.input}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity onPress={handleGift} disabled={sendingGift} style={styles.iconButton}>
            <Ionicons name="gift" size={22} color={colors.pink} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="share-social" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
    gap: 10,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    backgroundColor: colors.danger,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveBadgeLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  viewerBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  viewerBadgeLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  placeholderText: {
    color: colors.textDim,
    fontSize: 13,
  },
  bottomArea: {
    marginTop: 'auto',
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  hostAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  hostName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  followButton: {
    marginLeft: 'auto',
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  followButtonActive: {
    backgroundColor: colors.surfaceAlt,
  },
  followLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  commentList: {
    maxHeight: 160,
    paddingHorizontal: 16,
  },
  commentRow: {
    color: colors.text,
    fontSize: 13,
    marginBottom: 8,
  },
  commentUser: {
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 13,
  },
  iconButton: {
    padding: 4,
  },
});
