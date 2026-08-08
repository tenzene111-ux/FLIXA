import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

// Traced from the FLIXA reference artwork: a single ribbon silhouette
// (viewBox 0 0 100 130) with a top-to-bottom brand gradient, plus a
// separate white play-triangle path. Keep this path in sync with
// scripts/generate-brand-assets.js, which rasterizes the exact same
// shape into the app icon / adaptive-icon PNGs app.json references.
export const FLIXA_RIBBON_PATH =
  'M23 118 C19 100 17 78 18 58 C19 48 23 40 31 34 C43 26 59 20 77 16 L83 24 C73 22 59 25 47 30 C37 34 29 39 25 46 C22 52 21 60 22 70 C23 85 25 100 29 112 L23 118 Z';
export const FLIXA_PLAY_PATH = 'M14 47 L38 56 L14 68 Z';

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
