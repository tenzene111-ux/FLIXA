import React from 'react';
import { Image } from 'react-native';

// The real FLIXA ribbon-F artwork, extracted directly from the
// reference the user provided (not a hand-traced approximation) — see
// scripts/generate-brand-assets.js for how the app icon / adaptive-icon
// layers are derived from this same source file.
const SYMBOL = require('../../assets/brand/flixa-symbol.png');

// Native aspect ratio of assets/brand/flixa-symbol.png.
const ASPECT_RATIO = 795 / 735;

export default function FlixaLogo({ size = 96 }: { size?: number }) {
  return <Image source={SYMBOL} style={{ width: size, height: size * ASPECT_RATIO }} resizeMode="contain" />;
}
