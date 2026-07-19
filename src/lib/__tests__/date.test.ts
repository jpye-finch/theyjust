import { addMonths, formatDayMonth, formatDisplayDate, isRealDate, toIsoDate } from '../date';

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

describe('formatDisplayDate', () => {
  it('renders an ISO date as day, month name, year', () => {
    expect(formatDisplayDate('2026-07-18')).toBe('18 July 2026');
    expect(formatDisplayDate('2024-02-29')).toBe('29 February 2024');
    expect(formatDisplayDate('2026-12-31')).toBe('31 December 2026');
  });

  it('drops the leading zero on single-digit days', () => {
    expect(formatDisplayDate('2026-01-05')).toBe('5 January 2026');
    expect(formatDisplayDate('2026-09-01')).toBe('1 September 2026');
  });

  // Read straight off the string rather than through Date, so the pinned
  // America/Los_Angeles test zone (or any device zone) can never shift the day.
  it('is timezone-proof', () => {
    expect(formatDisplayDate('2026-03-01')).toBe('1 March 2026');
    expect(formatDisplayDate('2026-01-01')).toBe('1 January 2026');
  });

  it('falls back to the raw value when it is not a real date', () => {
    expect(formatDisplayDate('2026-02-30')).toBe('2026-02-30');
    expect(formatDisplayDate('not a date')).toBe('not a date');
    expect(formatDisplayDate('')).toBe('');
  });
});

describe('toIsoDate', () => {
  it('formats a Date as zero-padded YYYY-MM-DD', () => {
    expect(toIsoDate(new Date(2026, 6, 18))).toBe('2026-07-18');
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  // Reads the LOCAL calendar fields, so a date picked at 11pm doesn't jump a
  // day the way toISOString() would in a negative-UTC zone.
  it('reads the local day, not the UTC day', () => {
    expect(toIsoDate(new Date(2026, 2, 9, 23, 30))).toBe('2026-03-09');
    expect(toIsoDate(new Date(2026, 11, 31, 22, 0))).toBe('2026-12-31');
  });
});

describe('formatDayMonth', () => {
  it('renders a stored date as day and abbreviated month', () => {
    expect(formatDayMonth('2026-07-08')).toBe('8 Jul');
  });

  it('drops the leading zero, which a narrow column does not need', () => {
    expect(formatDayMonth('2025-01-05')).toBe('5 Jan');
  });

  it('abbreviates the longer month names', () => {
    expect(formatDayMonth('2025-09-30')).toBe('30 Sep');
    expect(formatDayMonth('2025-02-01')).toBe('1 Feb');
  });

  it('returns the raw value when it is not a date', () => {
    // Same defensive contract as formatDisplayDate: never render "NaN".
    expect(formatDayMonth('nonsense')).toBe('nonsense');
  });
});

describe('addMonths', () => {
  it('advances by whole months', () => {
    expect(addMonths('2026-01-15', 1)).toBe('2026-02-15');
    expect(addMonths('2026-01-15', 7)).toBe('2026-08-15');
    expect(addMonths('2026-01-15', 24)).toBe('2028-01-15');
  });

  it('clamps to the last day of a shorter month', () => {
    // 31 Jan + 1 month has no 31 Feb to land on.
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('knows about leap years', () => {
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2028-02-29', 12)).toBe('2029-02-28');
  });

  it('goes backwards too', () => {
    expect(addMonths('2026-03-15', -1)).toBe('2026-02-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });
});
