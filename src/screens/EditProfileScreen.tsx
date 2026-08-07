import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { updateUserProfile, uploadAvatar } from '../services/users';
import type { ProfileStackParamList } from '../navigation/ProfileStackNavigator';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { user } = useAuth();
  const profile = useUserProfile(user?.uid);

  const [displayName, setDisplayName] = useState('');
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setDisplayName(profile.displayName);
  }, [profile]);

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo library permission needed', 'Enable photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setLocalPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const photoURL = localPhotoUri ? await uploadAvatar(user.uid, localPhotoUri) : undefined;
      await updateUserProfile(user.uid, {
        displayName: displayName.trim() || profile?.username || 'Flixa user',
        ...(photoURL ? { photoURL } : {}),
      });
      navigation.goBack();
    } catch {
      Alert.alert('Could not save changes', 'Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const avatarUri = localPhotoUri ?? profile?.photoURL ?? null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={8}>
          {saving ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.saveLabel}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.85}>
          <LinearGradient
            colors={colors.gradient}
            style={styles.avatarRing}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{(profile?.username ?? '?').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={16} color={colors.text} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.changePhotoLabel}>Change photo</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={colors.textDim}
            maxLength={40}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Username</Text>
          <View style={styles.usernameRow}>
            <Text style={styles.usernameText}>@{profile?.username ?? ''}</Text>
            <Ionicons name="lock-closed" size={14} color={colors.textDim} />
          </View>
          <Text style={styles.fieldHint}>Username can't be changed</Text>
        </View>
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
    fontSize: 16,
    fontWeight: '700',
  },
  saveLabel: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  body: {
    alignItems: 'center',
    paddingTop: 28,
    paddingHorizontal: 24,
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: colors.background,
  },
  avatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: colors.background,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  changePhotoLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 32,
  },
  field: {
    width: '100%',
    marginBottom: 20,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  usernameText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  fieldHint: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 6,
  },
});
