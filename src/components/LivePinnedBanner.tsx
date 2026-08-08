import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

export default function LivePinnedBanner({ message }: { message: string }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="pin" size={12} color={colors.pink} />
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
});
