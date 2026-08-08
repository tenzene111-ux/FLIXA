// Regenerates the app-icon / adaptive-icon / favicon PNGs from the same
// ribbon-F path data used by src/components/FlixaLogo.tsx, so the native
// icon and the in-app SVG logo can never visually drift apart. Run with:
//   node scripts/generate-brand-assets.js
'use strict';

const path = require('path');
const sharp = require('sharp');

// Keep these two strings identical to FLIXA_RIBBON_PATH / FLIXA_PLAY_PATH
// in src/components/FlixaLogo.tsx.
const RIBBON_PATH =
  'M17 122 C11 102 9 78 11 56 C13 44 19 34 29 27 C43 17 61 10 79 8 C87 7 92 11 91 18 C89 24 82 27 73 28 C61 30 49 35 40 42 C33 47 28 54 25 62 C22 70 21 80 22 90 C23 100 25 110 29 118 C25 122 20 124 17 122 Z';
const PLAY_PATH = 'M16 44 L46 58 L16 74 Z';

const BLACK = '#050509';

function symbolMarkup(scalePct, monochrome) {
  // scalePct: symbol height as a fraction of the 1024 canvas.
  const canvas = 1024;
  const symbolHeight = canvas * scalePct;
  const symbolWidth = symbolHeight * (100 / 130);
  const scale = symbolHeight / 130;
  const tx = (canvas - symbolWidth) / 2;
  const ty = (canvas - symbolHeight) / 2;

  const ribbonFill = monochrome ? '#FFFFFF' : 'url(#ribbonGradient)';
  const playFill = monochrome ? '#FFFFFF' : '#F7F7FA';

  return `
    <defs>
      <linearGradient id="ribbonGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FF0A6C" />
        <stop offset="0.4" stop-color="#D81BFF" />
        <stop offset="0.65" stop-color="#7A3CFF" />
        <stop offset="1" stop-color="#18D7E8" />
      </linearGradient>
    </defs>
    <g transform="translate(${tx},${ty}) scale(${scale})">
      <path d="${RIBBON_PATH}" fill="${ribbonFill}" />
      <path d="${PLAY_PATH}" fill="${playFill}" />
    </g>
  `;
}

function svgDoc(size, bodyMarkup) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${bodyMarkup}</svg>`;
}

async function render(svg, outPath, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
  console.log('wrote', outPath);
}

async function main() {
  const assets = path.join(__dirname, '..', 'assets');

  // 1. Flat app icon (iOS + fallback): black square, no rounding — the OS
  // applies its own corner mask.
  await render(
    svgDoc(1024, `<rect width="1024" height="1024" fill="${BLACK}" />${symbolMarkup(0.56, false)}`),
    path.join(assets, 'icon.png'),
    1024
  );

  // 2. Android adaptive icon foreground: transparent, symbol scaled down
  // so it stays inside the launcher's safe zone regardless of mask shape.
  await render(svgDoc(1024, symbolMarkup(0.4, false)), path.join(assets, 'android-icon-foreground.png'), 1024);

  // 3. Android adaptive icon background: flat brand black, full bleed.
  await render(svgDoc(1024, `<rect width="1024" height="1024" fill="${BLACK}" />`), path.join(assets, 'android-icon-background.png'), 1024);

  // 4. Android 13+ themed monochrome icon: single-color silhouette.
  await render(svgDoc(1024, symbolMarkup(0.4, true)), path.join(assets, 'android-icon-monochrome.png'), 1024);

  // 5. Web favicon: same flat-icon composition, smaller.
  await render(
    svgDoc(1024, `<rect width="1024" height="1024" fill="${BLACK}" />${symbolMarkup(0.56, false)}`),
    path.join(assets, 'favicon.png'),
    256
  );

  // 6. Splash symbol: transparent, used if a legacy splash config ever
  // references assets/splash-icon.png directly.
  await render(svgDoc(1024, symbolMarkup(0.44, false)), path.join(assets, 'splash-icon.png'), 1024);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
