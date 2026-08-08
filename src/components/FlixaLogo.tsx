import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';

// Placeholder brand mark — swap this file's contents for
// <Image source={require('../../assets/brand/flixa-symbol.png')} style={{ width: size, height: size }} />
// the moment the real ribbon-F artwork is provided. Every screen that
// renders the logo imports this component, so that's the only file that
// needs to change.
export default function FlixaLogo({ size = 96 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.mark, { width: size, height: size, borderRadius: size * 0.28 }]}
      >
        <View
          style={[
            styles.playTriangle,
            {
              borderTopWidth: size * 0.19,
              borderBottomWidth: size * 0.19,
              borderLeftWidth: size * 0.3,
              marginLeft: size * 0.08,
            },
          ]}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.text,
  },
});
