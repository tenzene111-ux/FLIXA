// Regenerates the Android adaptive-icon layers / favicon / splash symbol
// from the real FLIXA artwork (assets/icon.png and assets/brand/flixa-symbol.png,
// both extracted directly from the user-provided reference — not hand-traced).
// Run with: node scripts/generate-brand-assets.js
'use strict';

const path = require('path');
const sharp = require('sharp');

const BLACK = '#050509';
const CANVAS = 1024;
const ASSETS = path.join(__dirname, '..', 'assets');
const SYMBOL = path.join(ASSETS, 'brand', 'flixa-symbol.png');

async function symbolLayer(scalePct, monochrome) {
  const targetHeight = Math.round(CANVAS * scalePct);
  let image = sharp(SYMBOL).resize({ height: targetHeight, kernel: 'lanczos3' });
  if (monochrome) {
    // Keep the shape (alpha channel) but flatten every visible pixel to
    // solid white, per Android 13+'s themed-icon requirement.
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += info.channels) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
    image = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  }
  return image.png().toBuffer();
}

async function render(compositeInput, backgroundColor, outPath, size) {
  const canvas = sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: backgroundColor } });
  const img = compositeInput ? canvas.composite([{ input: compositeInput, gravity: 'center' }]) : canvas;
  await img.resize(size, size).png().toFile(outPath);
  console.log('wrote', outPath);
}

async function main() {
  // Android adaptive icon foreground: transparent, scaled down so it
  // survives the launcher's mask crop regardless of shape.
  await render(await symbolLayer(0.42, false), { r: 0, g: 0, b: 0, alpha: 0 }, path.join(ASSETS, 'android-icon-foreground.png'), 1024);

  // Android adaptive icon background: flat brand black, full bleed.
  await render(null, BLACK, path.join(ASSETS, 'android-icon-background.png'), 1024);

  // Android 13+ themed monochrome icon.
  await render(await symbolLayer(0.42, true), { r: 0, g: 0, b: 0, alpha: 0 }, path.join(ASSETS, 'android-icon-monochrome.png'), 1024);

  // Web favicon: reuse the real icon.png (already the exact reference
  // artwork), just downsized.
  await sharp(path.join(ASSETS, 'icon.png')).resize(256, 256).png().toFile(path.join(ASSETS, 'favicon.png'));
  console.log('wrote', path.join(ASSETS, 'favicon.png'));

  // Splash symbol: transparent, for any legacy splash config that
  // references assets/splash-icon.png directly.
  await render(await symbolLayer(0.46, false), { r: 0, g: 0, b: 0, alpha: 0 }, path.join(ASSETS, 'splash-icon.png'), 1024);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
