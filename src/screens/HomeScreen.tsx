import React, { useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import VideoCard from '../components/VideoCard';
import videos from '../data/videos';
import colors from '../theme/colors';

const { height } = Dimensions.get('window');
const ITEM_HEIGHT = height;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [activeFeed, setActiveFeed] = useState<'following' | 'forYou'>('forYou');

  return (
    <View style={styles.container}>
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <VideoCard post={item} />}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
      />

      <View style={[styles.header, { top: insets.top + 8 }]} pointerEvents="box-none">
        <TouchableOpacity onPress={() => setActiveFeed('following')} style={styles.headerTab}>
          <Text style={[styles.headerTabText, activeFeed !== 'following' && styles.headerTabTextInactive]}>
            Following
          </Text>
          {activeFeed === 'following' && <View style={styles.headerTabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveFeed('forYou')} style={styles.headerTab}>
          <Text style={[styles.headerTabText, activeFeed !== 'forYou' && styles.headerTabTextInactive]}>
            For You
          </Text>
          {activeFeed === 'forYou' && <View style={styles.headerTabUnderline} />}
        </TouchableOpacity>

        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search" size={22} color={colors.text} />
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
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTab: {
    alignItems: 'center',
    marginHorizontal: 14,
  },
  headerTabText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerTabTextInactive: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  headerTabUnderline: {
    marginTop: 6,
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  searchButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
});
