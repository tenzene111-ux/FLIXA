import React from 'react';
import { Dimensions, FlatList, StyleSheet, View } from 'react-native';
import VideoCard from '../components/VideoCard';
import videos from '../data/videos';
import colors from '../theme/colors';

const { height } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 64;
const ITEM_HEIGHT = height - TAB_BAR_HEIGHT;

export default function HomeScreen() {
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
