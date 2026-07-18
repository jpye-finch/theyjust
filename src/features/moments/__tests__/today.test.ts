import { todayIso } from '../today';

describe('todayIso', () => {
  it('formats the local calendar date as zero-padded YYYY-MM-DD', () => {
    expect(todayIso(new Date('2026-07-04T12:00:00Z'))).toBe('2026-07-04');
    expect(todayIso(new Date('2026-01-09T18:00:00Z'))).toBe('2026-01-09');
  });

  it('reads the local day, not the UTC day', () => {
    // 05:30 UTC on 2026-03-10 is still 2026-03-09 in America/Los_Angeles.
    expect(todayIso(new Date('2026-03-10T05:30:00Z'))).toBe('2026-03-09');
  });
});
