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

  // OEM masks vary, so every opaque pixel must sit inside the 66dp safe
  // circle: radius 132 about (216,216).
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
