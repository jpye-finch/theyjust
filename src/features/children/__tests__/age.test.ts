import { ageInMonths, ageParts, childAge, formatAgeParts, formatChildAge } from '../age';

describe('ageParts', () => {
  it('computes whole months and remainder weeks', () => {
    expect(ageParts('2026-01-15', '2026-05-29')).toEqual({ months: 4, weeks: 2 });
  });

  it('handles under one month as weeks only', () => {
    expect(ageParts('2026-01-01', '2026-01-22')).toEqual({ months: 0, weeks: 3 });
  });

  it('treats the clamped month-end as the monthly anniversary (Jan 31 → Feb 28)', () => {
    // A baby born Jan 31 turns one month on Feb 28 — in a shorter month, the
    // last day IS the anniversary (standard clamped-anniversary convention).
    expect(ageParts('2026-01-31', '2026-02-28')).toEqual({ months: 1, weeks: 0 });
  });

  it('is zero on the day of birth', () => {
    expect(ageParts('2026-03-10', '2026-03-10')).toEqual({ months: 0, weeks: 0 });
  });
});

describe('ageInMonths', () => {
  it('is exact on month anniversaries', () => {
    expect(ageInMonths('2026-01-01', '2026-07-01')).toBe(6);
  });

  it('adds a day-based fraction between anniversaries', () => {
    expect(ageInMonths('2026-01-01', '2026-07-16')).toBeCloseTo(6.49, 1);
  });
});

describe('childAge', () => {
  it('has no corrected age for term babies (due_date null)', () => {
    const a = childAge('2026-01-01', null, '2026-07-01');
    expect(a.corrected).toBeNull();
    expect(a.chronological).toEqual({ months: 6, weeks: 0 });
    expect(a.comparisonMonths).toBe(6);
  });

  it('uses corrected age for comparisons when premature', () => {
    const a = childAge('2026-01-01', '2026-03-01', '2026-07-01');
    expect(a.chronological).toEqual({ months: 6, weeks: 0 });
    expect(a.corrected).toEqual({ months: 4, weeks: 0 });
    expect(a.comparisonMonths).toBe(4);
  });

  it('stops correcting at 24 months corrected (standard practice)', () => {
    const a = childAge('2024-01-01', '2024-03-01', '2026-03-15');
    expect(a.corrected).toBeNull();
    expect(a.comparisonMonths).toBeCloseTo(26.46, 1);
  });

  it('still corrects just under the cutoff', () => {
    const a = childAge('2024-01-01', '2024-03-01', '2026-02-15');
    expect(a.corrected).toEqual({ months: 23, weeks: 2 });
    expect(a.comparisonMonths).toBeCloseTo(23.46, 1);
  });
});

describe('formatAgeParts', () => {
  it('formats months and weeks', () => {
    expect(formatAgeParts({ months: 4, weeks: 2 })).toBe('4 months, 2 weeks');
  });

  it('omits zero weeks', () => {
    expect(formatAgeParts({ months: 6, weeks: 0 })).toBe('6 months');
  });

  it('uses singular forms', () => {
    expect(formatAgeParts({ months: 1, weeks: 1 })).toBe('1 month, 1 week');
  });

  it('formats under a month as weeks', () => {
    expect(formatAgeParts({ months: 0, weeks: 3 })).toBe('3 weeks');
  });

  it('handles the first days of life', () => {
    expect(formatAgeParts({ months: 0, weeks: 0 })).toBe('less than a week');
  });

  it('switches to years from 24 months', () => {
    expect(formatAgeParts({ months: 27, weeks: 1 })).toBe('2 years, 3 months');
    expect(formatAgeParts({ months: 24, weeks: 0 })).toBe('2 years');
  });
});

describe('formatChildAge', () => {
  it('shows only chronological for term children', () => {
    expect(formatChildAge(childAge('2026-01-01', null, '2026-07-01'))).toBe('6 months');
  });

  it('shows both ages for premature children', () => {
    expect(formatChildAge(childAge('2026-01-01', '2026-03-01', '2026-07-01'))).toBe(
      '6 months — 4 months corrected',
    );
  });
});

describe('Date-instant inputs (local calendar semantics)', () => {
  // jest.setup.js pins TZ=America/Los_Angeles, so late evening local is
  // already "tomorrow" in UTC — these fail if UTC getters sneak back in.
  it('reads a Date as the local calendar date, not UTC', () => {
    expect(ageParts('2026-01-01', new Date(2026, 0, 14, 23, 30))).toEqual({
      months: 0,
      weeks: 1,
    });
  });

  it('accepts Date instants in childAge', () => {
    const a = childAge('2026-01-01', null, new Date(2026, 6, 1, 12, 0));
    expect(a.chronological).toEqual({ months: 6, weeks: 0 });
  });
});

describe('boundaries and monotonicity', () => {
  it('wraps a single month across the year boundary', () => {
    expect(ageParts('2025-12-15', '2026-01-15')).toEqual({ months: 1, weeks: 0 });
  });

  it('never decreases as time advances (two years, day by day)', () => {
    let prev = -1;
    const start = Date.UTC(2026, 0, 31); // month-end DOB stresses clamping
    for (let i = 0; i <= 730; i++) {
      const on = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const m = ageInMonths('2026-01-31', on);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });
});
