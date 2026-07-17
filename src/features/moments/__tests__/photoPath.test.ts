import { RESIZE, photoObjectPath } from '../photoPath';

describe('photoObjectPath', () => {
  it('namespaces by moment id so storage RLS can find the moment', () => {
    expect(photoObjectPath('mom-1', 'photo-abc')).toBe('mom-1/photo-abc.jpg');
  });
});

describe('RESIZE', () => {
  it('caps the long edge and compresses (keeps files small, storage cheap)', () => {
    expect(RESIZE.maxDimension).toBe(2048);
    expect(RESIZE.compress).toBeGreaterThan(0);
    expect(RESIZE.compress).toBeLessThanOrEqual(1);
  });
});
