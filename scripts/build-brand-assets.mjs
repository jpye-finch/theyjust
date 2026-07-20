#!/usr/bin/env node
// Rasterises the committed SVG sources in assets/brand/ into assets/images/.
// Run with `npm run brand:build`. Requires ImageMagick, but app builds do not:
// the generated PNGs are committed.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brand = join(root, 'assets', 'brand');
const images = join(root, 'assets', 'images');

// `opaque` flattens onto the field and strips the alpha channel entirely —
// required for the iOS icon, which the App Store rejects if it has alpha.
const TARGETS = [
  { source: 'icon.svg', output: 'icon.png', opaque: '#833045' },
  { source: 'android-foreground.svg', output: 'android-icon-foreground.png' },
  { source: 'android-monochrome.svg', output: 'android-icon-monochrome.png' },
  { source: 'notification.svg', output: 'notification-icon.png' },
  { source: 'splash.svg', output: 'splash-icon.png' },
  { source: 'icon.svg', output: 'favicon.png', resize: 196 },
];

function build({ source, output, opaque, resize }) {
  const args = ['-background', opaque ?? 'none', join(brand, source)];
  if (resize) args.push('-resize', `${resize}x${resize}`);
  if (opaque) args.push('-flatten', '-alpha', 'off', '-define', 'png:color-type=2');
  // Transparent outputs: ImageMagick may optimise these down to a palette
  // (colour type 3) or grayscale+alpha (colour type 4) PNG, which pngReader.ts
  // deliberately rejects. Force true RGBA so it always reads as colour type 6.
  else args.push('-define', 'png:color-type=6');
  args.push('-colorspace', 'sRGB', '-depth', '8', join(images, output));

  execFileSync('magick', args, { stdio: 'inherit' });
  console.log(`  ${source} -> assets/images/${output}`);
}

console.log('Building brand assets...');
for (const target of TARGETS) build(target);
console.log('Done.');
