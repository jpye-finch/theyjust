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
