import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import videos from '../data/videos';

const { width } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COLUMNS = 3;
const THUMB_SIZE = (width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const emailPrefix = user?.email?.split('@')[0];
  const displayName = emailPrefix ?? 'Alex Carter';
  const handle = emailPrefix ? `@${emailPrefix}` : '@alexcartermusic';

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerSpacer} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerName} numberOfLines={1}>
            {displayName}
          </Text>
          <Ionicons name="checkmark-circle" size={15} color={colors.cyan} style={styles.headerBadge} />
        </View>
        <TouchableOpacity style={styles.headerAction} onPress={signOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.profileTop}>
        <LinearGradient colors={colors.gradient} style={styles.avatarRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Image source={{ uri: 'https://i.pravatar.cc/150?img=12' }} style={styles.avatar} />
        </LinearGradient>

        <Text style={styles.handle}>{handle}</Text>

        <View style={styles.statsRow}>
          <Stat label="Following" value="230" />
          <Stat label="Followers" value="125.8K" />
          <Stat label="Likes" value="2.3M" />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.editButton} activeOpacity={0.85}>
            <Text style={styles.editButtonLabel}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="share-outline" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="bookmark-outline" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.bio}>Musician | Creator | Dreamer</Text>
        <Text style={styles.bioLine}>New song out now 🎵 👇</Text>
      </View>

      <View style={styles.gridHeader}>
        <View style={[styles.gridTab, styles.gridTabActive]}>
          <Ionicons name="grid-outline" size={18} color={colors.text} />
        </View>
        <View style={styles.gridTab}>
          <Ionicons name="bookmark-outline" size={18} color={colors.textDim} />
        </View>
        <View style={styles.gridTab}>
          <Ionicons name="pricetag-outline" size={18} color={colors.textDim} />
        </View>
      </View>

      <View style={styles.grid}>
        {videos.map((video) => (
          <LinearGradient
            key={video.id}
            colors={video.gradient}
            style={styles.gridThumb}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
          >
            <View style={styles.gridThumbViews}>
              <Ionicons name="play" size={11} color={colors.text} />
              <Text style={styles.gridThumbViewsLabel}>{video.likes}</Text>
            </View>
          </LinearGradient>
        ))}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerSpacer: {
    width: 28,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    maxWidth: '70%',
  },
  headerBadge: {
    marginLeft: 5,
  },
  headerAction: {
    padding: 4,
  },
  handle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 8,
  },
  profileTop: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: colors.background,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  stat: {
    alignItems: 'center',
    marginHorizontal: 20,
  },
  statValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 10,
  },
  editButton: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 28,
  },
  editButtonLabel: {
    color: colors.textOnLight,
    fontSize: 14,
    fontWeight: '700',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bio: {
    color: colors.text,
    fontSize: 13,
    marginTop: 16,
  },
  bioLine: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  gridTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  gridTabActive: {
    borderTopWidth: 2,
    borderTopColor: colors.text,
    marginTop: -1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE * 1.4,
    justifyContent: 'flex-end',
    padding: 6,
  },
  gridThumbViews: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  gridThumbViewsLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
});
