import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useVideoPlayer, VideoView } from 'expo-video';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { createPost } from '../services/posts';
import CameraCapture from '../components/CameraCapture';
import { getErrorMessage } from '../utils/errors';
import { logEvent } from '../services/analytics';
import type { MainTabParamList } from '../navigation/MainTabNavigator';

type Selection = {
  videoUri: string;
  thumbnailUri: string;
};

export default function UploadScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { user } = useAuth();

  const [showCamera, setShowCamera] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const player = useVideoPlayer(selection?.videoUri ?? null, (p) => {
    p.loop = true;
    p.play();
  });

  const buildSelection = async (videoUri: string) => {
    try {
      const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 0 });
      setSelection({ videoUri, thumbnailUri });
    } catch (error) {
      const message = getErrorMessage(error, 'Please try a different clip.');
      Alert.alert("Couldn't process that video", message);
    }
  };

  const handleCameraCaptured = (videoUri: string) => {
    setShowCamera(false);
    buildSelection(videoUri);
  };

  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo library permission needed', 'Enable photo library access in Settings to pick a video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
    });
    if (!result.canceled && result.assets[0]) {
      await buildSelection(result.assets[0].uri);
    }
  };

  const handleDiscard = () => {
    player.pause();
    setSelection(null);
    setCaption('');
  };

  const handlePost = async () => {
    if (!selection || !user) return;
    setUploading(true);
    setProgress(0);
    try {
      await createPost({
        uid: user.uid,
        caption: caption.trim(),
        videoUri: selection.videoUri,
        thumbnailUri: selection.thumbnailUri,
        onProgress: setProgress,
      });
      setSelection(null);
      setCaption('');
      logEvent('post_created', user.uid);
      navigation.navigate('Home');
    } catch (error) {
      const message = getErrorMessage(error, 'Please check your connection and try again.');
      Alert.alert('Upload failed', message);
    } finally {
      setUploading(false);
    }
  };

  if (showCamera) {
    return <CameraCapture onCaptured={handleCameraCaptured} onClose={() => setShowCamera(false)} />;
  }

  if (!selection) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="videocam-outline" size={56} color={colors.textMuted} />
        <Text style={styles.title}>Create a video</Text>
        <Text style={styles.subtitle}>Record something new or upload from your gallery</Text>

        <TouchableOpacity onPress={() => setShowCamera(true)} activeOpacity={0.85} style={styles.primaryButtonWrap}>
          <LinearGradient
            colors={colors.gradientButton}
            style={styles.primaryButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="videocam" size={20} color={colors.text} />
            <Text style={styles.primaryButtonLabel}>Record</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={handlePickFromGallery} activeOpacity={0.85} style={styles.secondaryButton}>
          <Ionicons name="images-outline" size={20} color={colors.text} />
          <Text style={styles.secondaryButtonLabel}>Choose from Gallery</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.preview}>
        <VideoView player={player} style={styles.previewVideo} contentFit="cover" nativeControls={false} />
        <TouchableOpacity style={[styles.closeButton, { top: insets.top + 8 }]} onPress={handleDiscard}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.captionBar, { paddingBottom: insets.bottom + 16 }]}>
        <TextInput
          style={styles.captionInput}
          placeholder="Write a caption..."
          placeholderTextColor={colors.textDim}
          value={caption}
          onChangeText={setCaption}
          multiline
          editable={!uploading}
        />

        <TouchableOpacity onPress={handlePost} disabled={uploading} activeOpacity={0.85}>
          <LinearGradient
            colors={colors.gradientButton}
            style={[styles.postButton, uploading && styles.postButtonDisabled]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {uploading ? (
              <>
                <ActivityIndicator color={colors.text} size="small" />
                <Text style={styles.postButtonLabel}>{Math.round(progress * 100)}%</Text>
              </>
            ) : (
              <Text style={styles.postButtonLabel}>Post</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  primaryButtonWrap: {
    width: '100%',
    marginBottom: 14,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
  },
  primaryButtonLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    width: '100%',
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  preview: {
    flex: 1,
  },
  previewVideo: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionBar: {
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  captionInput: {
    color: colors.text,
    fontSize: 14,
    maxHeight: 80,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 24,
    gap: 8,
  },
  postButtonDisabled: {
    opacity: 0.7,
  },
  postButtonLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
