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
