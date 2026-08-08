import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

// Traced from the FLIXA reference artwork: a single ribbon silhouette
// (viewBox 0 0 100 130) with a top-to-bottom brand gradient, plus a
// separate white play-triangle path. Keep this path in sync with
// scripts/generate-brand-assets.js, which rasterizes the exact same
// shape into the app icon / adaptive-icon PNGs app.json references.
export const FLIXA_RIBBON_PATH =
  'M17 122 C11 102 9 78 11 56 C13 44 19 34 29 27 C43 17 61 10 79 8 C87 7 92 11 91 18 C89 24 82 27 73 28 C61 30 49 35 40 42 C33 47 28 54 25 62 C22 70 21 80 22 90 C23 100 25 110 29 118 C25 122 20 124 17 122 Z';
export const FLIXA_PLAY_PATH = 'M16 44 L46 58 L16 74 Z';

type Props = {
  size?: number;
};

export default function FlixaLogo({ size = 96 }: Props) {
  const height = (size * 130) / 100;
  return (
    <Svg width={size} height={height} viewBox="0 0 100 130">
      <Defs>
        <LinearGradient id="flixaRibbonGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF0A6C" />
          <Stop offset="0.4" stopColor="#D81BFF" />
          <Stop offset="0.65" stopColor="#7A3CFF" />
          <Stop offset="1" stopColor="#18D7E8" />
        </LinearGradient>
      </Defs>
      <Path d={FLIXA_RIBBON_PATH} fill="url(#flixaRibbonGradient)" />
      <Path d={FLIXA_PLAY_PATH} fill="#F7F7FA" />
    </Svg>
  );
}
