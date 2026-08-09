import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import VideoCard from '../components/VideoCard';
import { subscribeToPost } from '../services/posts';
import type { Post } from '../types/post';

const { height } = Dimensions.get('window');

// Shared param shape — registered under this same name in every stack that
// needs to open a single video outside the swipeable feed (Sound/Hashtag
// grids, a shared-video chat card, a profile grid). Each stack's own
// navigator supplies the concrete UserProfile/Comments routes to push to.
export type SingleVideoParams = { postId: string };

type StackParamList = {
  SingleVideo: SingleVideoParams;
  UserProfile: { uid: string };
  Comments: { postId: string; postOwnerUid: string; postThumbnailUrl: string };
};

export default function SingleVideoScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  const route = useRoute<RouteProp<StackParamList, 'SingleVideo'>>();
  const { postId } = route.params;

  const [post, setPost] = useState<Post | null | undefined>(undefined);

  useEffect(() => {
    return subscribeToPost(postId, setPost);
  }, [postId]);

  return (
    <View style={styles.container}>
      {post === undefined ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : post === null ? (
        <View style={styles.missingState}>
          <Ionicons name="videocam-off-outline" size={40} color={colors.textDim} />
          <Text style={styles.missingTitle}>This video isn't available</Text>
        </View>
      ) : (
        <VideoCard
          post={post}
          isActive
          height={height}
          onPressAuthor={() => navigation.navigate('UserProfile', { uid: post.uid })}
          onPressComments={() =>
            navigation.navigate('Comments', { postId: post.id, postOwnerUid: post.uid, postThumbnailUrl: post.thumbnailUrl })
          }
          onNotInterested={() => navigation.goBack()}
        />
      )}

      <TouchableOpacity style={[styles.backButton, { top: insets.top + 8 }]} onPress={navigation.goBack} hitSlop={8}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
  },
  missingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  missingTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    position: 'absolute',
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
