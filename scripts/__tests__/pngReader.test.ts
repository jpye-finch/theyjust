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
    const buf = fixture(['-size', '2x1', 'xc:none', '-define', 'png:color-type=6'], 'alpha.png');
    const png = readPng(buf);

    expect(png.hasAlpha).toBe(true);
    expect(png.pixel(0, 0)[3]).toBe(0);
  });
});
