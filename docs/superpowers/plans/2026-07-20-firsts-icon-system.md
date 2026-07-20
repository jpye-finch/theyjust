# Firsts Icon System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every piece of Expo scaffold artwork with the Firsts icon system — a paper bookmark set into a damson field — generated reproducibly from committed SVG sources.

**Architecture:** SVG sources in `assets/brand/` are the editable truth. A Node build script rasterises them to `assets/images/` with ImageMagick. Generated PNGs are committed, so app builds never need ImageMagick. Verification is a Jest suite that parses the PNGs in pure JavaScript — no external binary — so it passes anywhere.

**Tech Stack:** Node 22 (ESM), ImageMagick 7 (`/opt/homebrew/bin/magick`, build-time only), Jest + `jest-expo`, Expo SDK 57.

**Spec:** `docs/superpowers/specs/2026-07-20-firsts-icon-system-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `assets/brand/icon.svg` | Master mark, 1024², full-bleed damson field |
| `assets/brand/android-foreground.svg` | Mark scaled into the 66dp safe circle, 432², transparent |
| `assets/brand/android-monochrome.svg` | White ribbon silhouette, 432², transparent |
| `assets/brand/notification.svg` | White ribbon silhouette, 96², transparent |
| `assets/brand/splash.svg` | Damson ribbon with the dot knocked through, 1024², transparent |
| `scripts/build-brand-assets.mjs` | Rasterises each source to its target in `assets/images/` |
| `scripts/pngReader.ts` | Dependency-free PNG reader (dimensions, alpha, pixels) |
| `scripts/__tests__/brandAssets.test.ts` | Verifies every generated asset |
| `app.json` | Rewired to the new assets |

`scripts/pngReader.ts` is deliberately separate from the build script: it is used only by tests and must not depend on ImageMagick.

**Why `.ts` and not `.mjs`:** the build script is `.mjs`, but `jest-expo`'s transform pattern is `\.[jt]sx?$`, which does not match `.mjs`. An `.mjs` helper resolves but loads untransformed and throws `SyntaxError: Unexpected token 'export'`. Only the tests need the reader, so TypeScript is the frictionless choice — no Jest config change required.

---

## Task 1: Verify the SVG rasteriser

The spec (§5) flags this as a risk. ImageMagick's `rsvg` delegate points at `rsvg-convert`, which is **not installed** on this machine, so rendering will fall back to ImageMagick's internal renderer. This task proves the internal renderer handles our geometry before five SVG files are written against it.

**Files:**
- Create: `/private/tmp/claude-501/-Users-jonathanpye-finch-theyjust/16d6138a-778b-4474-b548-1b72dc330004/scratchpad/spike.svg` (throwaway, not committed)

- [ ] **Step 1: Write a probe SVG exercising every feature the real sources need**

Write to the scratchpad path above:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#833045"/>
  <path fill-rule="evenodd" fill="#F9F6F1"
        d="M20 0 L80 0 L80 80 L50 60 L20 80 Z M50 20 A10 10 0 1 1 50 40 A10 10 0 1 1 50 20 Z"/>
</svg>
```

This covers all four things the real sources rely on: a solid `rect`, a `path` with straight segments, elliptical arcs (`A`), and `fill-rule="evenodd"` for the knocked-through dot.

- [ ] **Step 2: Rasterise and inspect**

```bash
SP=/private/tmp/claude-501/-Users-jonathanpye-finch-theyjust/16d6138a-778b-4474-b548-1b72dc330004/scratchpad
magick -background none "$SP/spike.svg" "$SP/spike.png"
magick identify -format '%wx%h %[channels]\n' "$SP/spike.png"
```

Expected: `100x100 srgba`.

- [ ] **Step 3: Confirm the evenodd hole is actually transparent**

```bash
magick "$SP/spike.png" -format '%[pixel:p{50,30}] %[pixel:p{50,70}] %[pixel:p{5,5}]\n' info:
```

Expected: pixel `(50,30)` is the hole — must be `none` or fully transparent. Pixel `(50,70)` is inside the ribbon — must be near `#F9F6F1`. Pixel `(5,5)` is the field — must be near `#833045`.

- [ ] **Step 4: Decide and record**

If Step 3 matches, the internal renderer is fine — proceed with SVG sources as planned and note it in the commit message.

**If the hole is opaque or the arcs are malformed**, stop and switch the build script to `magick -draw` primitives instead:
- ribbon → `-draw "polygon x1,y1 x2,y2 ..."`
- dot → `-draw "circle cx,cy cx,cy+r"` in the field colour, or `-alpha set -channel RGBA -fill none` for the splash hole

The SVG sources are still authored and committed either way (spec §5 keeps them as the human-readable reference); only the rasterisation path changes. Every geometry value in Tasks 3–6 stays identical.

- [ ] **Step 5: No commit**

This is a throwaway spike in the scratchpad. Nothing to commit.

---

## Task 2: The PNG reader

A dependency-free reader so verification never needs ImageMagick. Handles exactly what we generate: 8-bit non-interlaced PNG, colour type 2 (RGB) or 6 (RGBA).

**Files:**
- Create: `scripts/pngReader.ts`
- Test: `scripts/__tests__/pngReader.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/pngReader.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPng } from '../pngReader';

// Built with ImageMagick here rather than committed as a fixture: the reader's
// whole job is to agree with what the build script actually produces.
function fixture(args: string[], name: string): Buffer {
  const dir = mkdtempSync(join(tmpdir(), 'png-'));
  const out = join(dir, name);
  execFileSync('magick', [...args, out]);
  return readFileSync(out);
}

describe('readPng', () => {
  it('reads dimensions and reports no alpha for an opaque RGB png', () => {
    const buf = fixture(
      ['-size', '8x4', 'xc:#833045', '-alpha', 'off', '-define', 'png:color-type=2'],
      'rgb.png',
    );
    const png = readPng(buf);

    expect(png.width).toBe(8);
    expect(png.height).toBe(4);
    expect(png.hasAlpha).toBe(false);
  });

  it('reads pixels as rgba tuples', () => {
    const buf = fixture(
      ['-size', '2x1', 'xc:#833045', '-alpha', 'off', '-define', 'png:color-type=2'],
      'px.png',
    );
    const png = readPng(buf);

    expect(png.pixel(0, 0)).toEqual([0x83, 0x30, 0x45, 255]);
  });

  it('reports alpha and transparent pixels for an RGBA png', () => {
    const buf = fixture(['-size', '2x1', 'xc:none'], 'alpha.png');
    const png = readPng(buf);

    expect(png.hasAlpha).toBe(true);
    expect(png.pixel(0, 0)[3]).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/__tests__/pngReader.test.ts`
Expected: FAIL — `Cannot find module '../pngReader'`.

- [ ] **Step 3: Write the implementation**

Create `scripts/pngReader.ts`:

```ts
// A minimal PNG reader for verifying our own generated assets. Deliberately
// dependency-free and deliberately narrow: 8-bit, non-interlaced, colour type
// 2 (RGB) or 6 (RGBA). Anything else is a bug in the build script, so we throw
// rather than trying to cope.
import { inflateSync } from 'node:zlib';

export type Rgba = [number, number, number, number];

export type Png = {
  width: number;
  height: number;
  hasAlpha: boolean;
  pixel(x: number, y: number): Rgba;
};

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function readPng(buffer: Buffer): Png {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a png');

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];

  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced png unsupported');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length; // length + type + data + crc
  }

  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  if (colorType !== 2 && colorType !== 6) {
    throw new Error(`unsupported colour type ${colorType}`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(stride * height);

  // Undo the per-scanline filter. Each scanline is prefixed with a filter byte
  // and encoded relative to the pixel to its left (a), the one above (b), and
  // the one above-left (c).
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? pixels[y * stride + x - channels] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += Math.floor((a + b) / 2);
      else if (filter === 4) value += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`unknown filter ${filter}`);
      pixels[y * stride + x] = value & 0xff;
    }
  }

  return {
    width,
    height,
    hasAlpha: colorType === 6,
    pixel(x: number, y: number): Rgba {
      const i = y * stride + x * channels;
      return [pixels[i], pixels[i + 1], pixels[i + 2], channels === 4 ? pixels[i + 3] : 255];
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/__tests__/pngReader.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/pngReader.ts scripts/__tests__/pngReader.test.ts
git commit -m "test: a dependency-free png reader for verifying brand assets"
```

---

## Task 3: The master icon

**Files:**
- Create: `assets/brand/icon.svg`, `scripts/build-brand-assets.mjs`
- Test: `scripts/__tests__/brandAssets.test.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/brandAssets.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPng } from '../pngReader';

const IMAGES = join(__dirname, '..', '..', 'assets', 'images');
const DAMSON = [0x83, 0x30, 0x45];
const PAPER = [0xf9, 0xf6, 0xf1];

function load(name: string) {
  return readPng(readFileSync(join(IMAGES, name)));
}

// Antialiasing means an edge pixel is a blend, so exact equality only holds
// well inside a shape. Sample points are chosen to sit in solid areas.
function expectColor(actual: number[], expected: number[]) {
  expect(actual.slice(0, 3)).toEqual(expected);
}

describe('icon.png', () => {
  const png = load('icon.png');

  it('is 1024x1024', () => {
    expect(png.width).toBe(1024);
    expect(png.height).toBe(1024);
  });

  // The App Store rejects icons with an alpha channel. This is the single most
  // valuable assertion in the file.
  it('has no alpha channel', () => {
    expect(png.hasAlpha).toBe(false);
  });

  it('paints the damson field in the corners', () => {
    expectColor(png.pixel(40, 40), DAMSON);
    expectColor(png.pixel(1000, 1000), DAMSON);
  });

  it('paints the paper ribbon', () => {
    expectColor(png.pixel(512, 80), PAPER); // above the dot
    expectColor(png.pixel(512, 560), PAPER); // below the dot
  });

  it('knocks the damson dot out of the ribbon', () => {
    expectColor(png.pixel(512, 372), DAMSON);
  });

  it('leaves the notch cut into the ribbon foot', () => {
    // Dead centre at the very bottom of the ribbon's bounding box: inside the
    // notch, so it must be field, not paper.
    expectColor(png.pixel(512, 735), DAMSON);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/__tests__/brandAssets.test.ts`
Expected: FAIL — the suite throws reading `icon.png`, or dimension/alpha assertions fail against the 799KB scaffold icon.

- [ ] **Step 3: Write the SVG source**

Create `assets/brand/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <!-- Firsts master mark. See docs/superpowers/specs/2026-07-20-firsts-icon-system-design.md
       The ribbon bleeds off the top edge deliberately: the page continues above,
       the marker is set into it. -->
  <rect width="1024" height="1024" fill="#833045"/>
  <path fill="#F9F6F1" fill-rule="evenodd"
        d="M362 0 L662 0 L662 740 L512 624 L362 740 Z
           M512 298 A74 74 0 1 1 512 446 A74 74 0 1 1 512 298 Z"/>
</svg>
```

- [ ] **Step 4: Write the build script**

Create `scripts/build-brand-assets.mjs`:

```js
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
];

function build({ source, output, opaque, resize }) {
  const args = ['-background', opaque ?? 'none', join(brand, source)];
  if (resize) args.push('-resize', `${resize}x${resize}`);
  if (opaque) args.push('-flatten', '-alpha', 'off', '-define', 'png:color-type=2');
  args.push('-colorspace', 'sRGB', join(images, output));

  execFileSync('magick', args, { stdio: 'inherit' });
  console.log(`  ${source} -> assets/images/${output}`);
}

console.log('Building brand assets...');
for (const target of TARGETS) build(target);
console.log('Done.');
```

- [ ] **Step 5: Add the npm script**

In `package.json`, add to `scripts`:

```json
"brand:build": "node scripts/build-brand-assets.mjs"
```

- [ ] **Step 6: Build and run the test**

```bash
npm run brand:build
npx jest scripts/__tests__/brandAssets.test.ts
```

Expected: build prints `icon.svg -> assets/images/icon.png`; all 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add assets/brand/icon.svg assets/images/icon.png scripts/build-brand-assets.mjs \
        scripts/__tests__/brandAssets.test.ts package.json
git commit -m "feat: the master icon, a bookmark set into a damson field"
```

---

## Task 4: Android foreground and monochrome

**Files:**
- Create: `assets/brand/android-foreground.svg`, `assets/brand/android-monochrome.svg`
- Modify: `scripts/build-brand-assets.mjs`, `scripts/__tests__/brandAssets.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/__tests__/brandAssets.test.ts`:

```ts
describe('android-icon-foreground.png', () => {
  const png = load('android-icon-foreground.png');

  it('is 432x432 with alpha', () => {
    expect(png.width).toBe(432);
    expect(png.height).toBe(432);
    expect(png.hasAlpha).toBe(true);
  });

  it('leaves the canvas transparent — backgroundColor supplies the field', () => {
    expect(png.pixel(10, 10)[3]).toBe(0);
    expect(png.pixel(421, 421)[3]).toBe(0);
  });

  it('paints the paper ribbon and the damson dot', () => {
    expectColor(png.pixel(216, 130), PAPER);
    expectColor(png.pixel(216, 216), DAMSON);
  });

  // Spec §7.5. OEM masks vary, so every opaque pixel must sit inside the 66dp
  // safe circle: radius 132 about (216,216).
  it('keeps every opaque pixel inside the 264px safe circle', () => {
    const offenders: string[] = [];
    for (let y = 0; y < 432; y += 1) {
      for (let x = 0; x < 432; x += 1) {
        if (png.pixel(x, y)[3] === 0) continue;
        if (Math.hypot(x - 216, y - 216) > 132) offenders.push(`${x},${y}`);
      }
    }
    expect(offenders.slice(0, 5)).toEqual([]);
  });
});

describe('android-icon-monochrome.png', () => {
  const png = load('android-icon-monochrome.png');

  it('is 432x432 with alpha', () => {
    expect(png.width).toBe(432);
    expect(png.height).toBe(432);
    expect(png.hasAlpha).toBe(true);
  });

  // The system tints this layer, so only the silhouette survives. Every opaque
  // pixel must be white — a stray damson dot would tint to a hole in the shape.
  it('contains only white and transparent pixels', () => {
    const offenders: string[] = [];
    for (let y = 0; y < 432; y += 4) {
      for (let x = 0; x < 432; x += 4) {
        const [r, g, b, a] = png.pixel(x, y);
        if (a === 0) continue;
        if (a === 255 && (r !== 255 || g !== 255 || b !== 255)) offenders.push(`${x},${y}`);
      }
    }
    expect(offenders.slice(0, 5)).toEqual([]);
  });

  it('has no dot knocked out — the ribbon is solid', () => {
    expect(png.pixel(216, 216)[3]).toBe(255);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest scripts/__tests__/brandAssets.test.ts`
Expected: FAIL — the scaffold foreground is the wrong size and has content outside the safe circle.

- [ ] **Step 3: Write the SVG sources**

Create `assets/brand/android-foreground.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432" viewBox="0 0 432 432">
  <!-- The mark scaled to 96x237 and centred in the 66dp safe circle (radius 132
       about 216,216). The scale is set by the bounding box's half-diagonal:
       hypot(48,118) = 127.4, leaving ~4px of margin for antialiasing. No bleed:
       OEM masks vary far more than Apple's, and a ribbon running off the top
       gets cut at an arbitrary angle. -->
  <path fill="#F9F6F1" d="M168 98 L264 98 L264 335 L216 298 L168 335 Z"/>
  <circle cx="216" cy="216" r="24" fill="#833045"/>
</svg>
```

Create `assets/brand/android-monochrome.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432" viewBox="0 0 432 432">
  <!-- Silhouette only: the system discards colour and tints this flat. The dot
       is dropped rather than knocked through, so this matches the notification
       icon exactly — one shape across both monochrome surfaces. Geometry is
       identical to android-foreground.svg. -->
  <path fill="#FFFFFF" d="M168 98 L264 98 L264 335 L216 298 L168 335 Z"/>
</svg>
```

- [ ] **Step 4: Register both targets**

In `scripts/build-brand-assets.mjs`, extend `TARGETS`:

```js
const TARGETS = [
  { source: 'icon.svg', output: 'icon.png', opaque: '#833045' },
  { source: 'android-foreground.svg', output: 'android-icon-foreground.png' },
  { source: 'android-monochrome.svg', output: 'android-icon-monochrome.png' },
];
```

- [ ] **Step 5: Build and run the tests**

```bash
npm run brand:build
npx jest scripts/__tests__/brandAssets.test.ts
```

Expected: all tests PASS, including the safe-circle sweep.

- [ ] **Step 6: Commit**

```bash
git add assets/brand/android-foreground.svg assets/brand/android-monochrome.svg \
        assets/images/android-icon-foreground.png assets/images/android-icon-monochrome.png \
        scripts/build-brand-assets.mjs scripts/__tests__/brandAssets.test.ts
git commit -m "feat: android foreground and monochrome layers"
```

---

## Task 5: The notification icon

The asset that has never existed — `expo-notifications` currently has nothing to render in the status bar.

**Files:**
- Create: `assets/brand/notification.svg`
- Modify: `scripts/build-brand-assets.mjs`, `scripts/__tests__/brandAssets.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `scripts/__tests__/brandAssets.test.ts`:

```ts
describe('notification-icon.png', () => {
  const png = load('notification-icon.png');

  // expo-notifications requires "96x96 all-white png with transparency".
  it('is 96x96 with alpha', () => {
    expect(png.width).toBe(96);
    expect(png.height).toBe(96);
    expect(png.hasAlpha).toBe(true);
  });

  it('contains only white and transparent pixels', () => {
    const offenders: string[] = [];
    for (let y = 0; y < 96; y += 1) {
      for (let x = 0; x < 96; x += 1) {
        const [r, g, b, a] = png.pixel(x, y);
        if (a === 0) continue;
        if (a === 255 && (r !== 255 || g !== 255 || b !== 255)) offenders.push(`${x},${y}`);
      }
    }
    expect(offenders.slice(0, 5)).toEqual([]);
  });

  it('is inset to the 72x72 content box', () => {
    for (let x = 0; x < 96; x += 1) {
      expect(png.pixel(x, 11)[3]).toBe(0); // above the mark
      expect(png.pixel(x, 85)[3]).toBe(0); // below the mark
    }
  });

  it('paints the ribbon', () => {
    expect(png.pixel(47, 40)[3]).toBe(255);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/__tests__/brandAssets.test.ts`
Expected: FAIL — `ENOENT`, `notification-icon.png` does not exist.

- [ ] **Step 3: Write the SVG source**

Create `assets/brand/notification.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <!-- Android renders this as a flat tinted silhouette and discards all colour,
       so shape is all that survives. No dot: at 96px a 3px hole fills in during
       antialiasing. -->
  <path fill="#FFFFFF" d="M33 12 L62 12 L62 84 L47.5 73 L33 84 Z"/>
</svg>
```

- [ ] **Step 4: Register the target**

In `scripts/build-brand-assets.mjs`, add to `TARGETS`:

```js
  { source: 'notification.svg', output: 'notification-icon.png' },
```

- [ ] **Step 5: Build and run the test**

```bash
npm run brand:build
npx jest scripts/__tests__/brandAssets.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add assets/brand/notification.svg assets/images/notification-icon.png \
        scripts/build-brand-assets.mjs scripts/__tests__/brandAssets.test.ts
git commit -m "feat: the notification icon the app has never had"
```

---

## Task 6: Splash and favicon

**Files:**
- Create: `assets/brand/splash.svg`
- Modify: `scripts/build-brand-assets.mjs`, `scripts/__tests__/brandAssets.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/__tests__/brandAssets.test.ts`:

```ts
describe('splash-icon.png', () => {
  const png = load('splash-icon.png');

  it('is 1024x1024 with alpha', () => {
    expect(png.width).toBe(1024);
    expect(png.height).toBe(1024);
    expect(png.hasAlpha).toBe(true);
  });

  it('drops the field so the mark sits on the paper background', () => {
    expect(png.pixel(40, 40)[3]).toBe(0);
  });

  it('inverts: the ribbon is damson', () => {
    expectColor(png.pixel(512, 80), DAMSON);
  });

  // The dot must be a hole, not a fill — damson on damson would be invisible,
  // so the paper background has to read through it.
  it('knocks the dot through to transparency', () => {
    expect(png.pixel(512, 372)[3]).toBe(0);
  });
});

describe('favicon.png', () => {
  const png = load('favicon.png');

  it('is 196x196', () => {
    expect(png.width).toBe(196);
    expect(png.height).toBe(196);
  });

  it('carries the damson field', () => {
    expectColor(png.pixel(8, 8), DAMSON);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest scripts/__tests__/brandAssets.test.ts`
Expected: FAIL — the scaffold `splash-icon.png` and `favicon.png` are the wrong size and colour.

- [ ] **Step 3: Write the splash SVG**

Create `assets/brand/splash.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <!-- Inverted: no field, damson ribbon, and the dot knocked through to
       transparency so the paper background reads through it. Rendered at
       imageWidth 240, which puts the ribbon at ~70pt. -->
  <path fill="#833045" fill-rule="evenodd"
        d="M362 0 L662 0 L662 740 L512 624 L362 740 Z
           M512 298 A74 74 0 1 1 512 446 A74 74 0 1 1 512 298 Z"/>
</svg>
```

- [ ] **Step 4: Register both targets**

In `scripts/build-brand-assets.mjs`, add to `TARGETS`:

```js
  { source: 'splash.svg', output: 'splash-icon.png' },
  { source: 'icon.svg', output: 'favicon.png', resize: 196 },
```

The favicon renders from the master source at full size and downsamples, which
antialiases better than rendering small.

- [ ] **Step 5: Build and run the tests**

```bash
npm run brand:build
npx jest scripts/__tests__/brandAssets.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add assets/brand/splash.svg assets/images/splash-icon.png assets/images/favicon.png \
        scripts/build-brand-assets.mjs scripts/__tests__/brandAssets.test.ts
git commit -m "feat: splash mark on paper, and the favicon"
```

---

## Task 7: Rewire `app.json`

**Files:**
- Modify: `app.json`
- Test: `scripts/__tests__/brandAssets.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `scripts/__tests__/brandAssets.test.ts`:

```ts
describe('app.json', () => {
  const config = JSON.parse(
    readFileSync(join(__dirname, '..', '..', 'app.json'), 'utf8'),
  ).expo;

  const plugin = (name: string) =>
    config.plugins.find((p: unknown) => Array.isArray(p) && p[0] === name)?.[1];

  it('drops the scaffold Icon Composer bundle so iOS inherits the 1024 png', () => {
    expect(config.ios.icon).toBeUndefined();
    expect(config.icon).toBe('./assets/images/icon.png');
  });

  it('uses a damson adaptive icon background with no background image', () => {
    expect(config.android.adaptiveIcon.backgroundColor).toBe('#833045');
    expect(config.android.adaptiveIcon.backgroundImage).toBeUndefined();
  });

  it('splashes on paper, not Expo blue', () => {
    expect(plugin('expo-splash-screen').backgroundColor).toBe('#F9F6F1');
    expect(plugin('expo-splash-screen').imageWidth).toBe(240);
  });

  it('gives expo-notifications an icon to render', () => {
    expect(plugin('expo-notifications').icon).toBe('./assets/images/notification-icon.png');
    expect(plugin('expo-notifications').color).toBe('#833045');
  });

  it('points every asset path at a file that exists', () => {
    const root = join(__dirname, '..', '..');
    const paths = [
      config.icon,
      config.android.adaptiveIcon.foregroundImage,
      config.android.adaptiveIcon.monochromeImage,
      config.web.favicon,
      plugin('expo-splash-screen').image,
      plugin('expo-notifications').icon,
    ];
    for (const p of paths) {
      expect(existsSync(join(root, p))).toBe(true);
    }
  });
});
```

Add `existsSync` to the file's `node:fs` import:

```ts
import { existsSync, readFileSync } from 'node:fs';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest scripts/__tests__/brandAssets.test.ts`
Expected: FAIL — `ios.icon` is still `./assets/expo.icon`, background is `#E6F4FE`, splash is `#208AEF`, notifications have no icon.

- [ ] **Step 3: Edit `app.json`**

Apply exactly these changes:

- Delete the `"icon": "./assets/expo.icon"` line from the `ios` object.
- In `android.adaptiveIcon`: set `"backgroundColor"` to `"#833045"` and **delete** the `"backgroundImage"` line.
- In the `expo-splash-screen` plugin options: `"backgroundColor"` to `"#F9F6F1"`, `"imageWidth"` to `240`.
- In the `expo-notifications` plugin options, add `"icon": "./assets/images/notification-icon.png"` alongside the existing `"color": "#833045"`.

Leave the top-level `"icon": "./assets/images/icon.png"` unchanged — iOS now inherits it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest scripts/__tests__/brandAssets.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Verify Expo resolves the config**

Run: `npx expo config --type prebuild`
Expected: prints the resolved config with no error. Confirm `ios.icon` resolves to the 1024 PNG and no path warnings appear.

- [ ] **Step 6: Commit**

```bash
git add app.json scripts/__tests__/brandAssets.test.ts
git commit -m "feat: point app.json at the new icon system"
```

---

## Task 8: Delete the scaffold artwork

**Files:**
- Delete: 9 files in `assets/images/`, plus `assets/expo.icon/`

- [ ] **Step 1: Re-confirm nothing references them**

The spec (§6) requires this check because an earlier grep for `icon` matched
unrelated identifiers like `tabIcons` and `iconName`.

```bash
grep -rn "expo-badge\|expo-logo\|react-logo\|logo-glow\|tutorial-web\|expo\.icon\|android-icon-background" \
  src app *.json 2>/dev/null | grep -v node_modules
```

Expected: **no output**. If anything appears, stop and resolve it before deleting.

- [ ] **Step 2: Confirm `icon.png` is referenced only from `app.json`**

```bash
grep -rn "images/icon" src app *.json 2>/dev/null | grep -v node_modules
```

Expected: exactly one line, in `app.json`.

- [ ] **Step 3: Delete**

```bash
git rm -r assets/expo.icon
git rm assets/images/expo-badge.png assets/images/expo-badge-white.png \
       assets/images/expo-logo.png assets/images/react-logo.png \
       assets/images/react-logo@2x.png assets/images/react-logo@3x.png \
       assets/images/logo-glow.png assets/images/tutorial-web.png \
       assets/images/android-icon-background.png
```

- [ ] **Step 4: Verify the app still builds its config and the suite is green**

```bash
npx expo config --type prebuild > /dev/null && echo "config ok"
npm test
```

Expected: `config ok`, and the full Jest suite passes — including the existing
component tests, which must be unaffected.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: delete the Expo scaffold artwork"
```

---

## Task 9: Human judgement at 40pt

Everything above is machine-checkable. This is the test that is not.

**Files:** none — this produces a render for review, not an artefact.

- [ ] **Step 1: Render the finished set at real size**

Show the user the generated `icon.png` at 40pt on both a light and a dark
wallpaper, next to the monochrome silhouette in a status bar, using the
`mcp__visualize__show_widget` tool. Source the images from the *generated PNGs*,
not by re-drawing the SVG — the point is to judge what actually shipped.

- [ ] **Step 2: Report and stop**

Summarise: every assertion from spec §7 that passed, anything that did not, and
the §8 checklist state. Ask whether the mark is right at 40pt before the branch
is considered finished. Do not merge or open a PR without an answer.

---

## Spec Coverage

| Spec section | Task |
| --- | --- |
| §2 master geometry | 3 |
| §3.1 iOS icon | 3 |
| §3.2 Android foreground | 4 |
| §3.3 Android background (removed) | 4, 7, 8 |
| §3.4 Android monochrome | 4 |
| §3.5 Notification icon | 5 |
| §3.6 Splash | 6 |
| §3.7 Favicon | 6 |
| §5 build pipeline | 1, 3 |
| §6 app.json + deletions | 7, 8 |
| §7.1–7.5 assertions | 3, 4, 5, 6 |
| §7.6 expo config resolves | 7, 8 |
| §7 human 40pt render | 9 |
