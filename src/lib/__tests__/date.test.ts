import { isRealDate } from '../date';

describe('isRealDate', () => {
  it('accepts real calendar dates, including leap days', () => {
    expect(isRealDate('2026-05-01')).toBe(true);
    expect(isRealDate('2024-02-29')).toBe(true);
  });

  it('rejects malformed strings', () => {
    expect(isRealDate('2026-5-1')).toBe(false);
    expect(isRealDate('01/05/2026')).toBe(false);
    expect(isRealDate('')).toBe(false);
  });

  it('rejects impossible calendar dates', () => {
    expect(isRealDate('2026-02-30')).toBe(false);
    expect(isRealDate('2025-02-29')).toBe(false);
    expect(isRealDate('2026-13-01')).toBe(false);
    expect(isRealDate('2026-00-10')).toBe(false);
  });
});
