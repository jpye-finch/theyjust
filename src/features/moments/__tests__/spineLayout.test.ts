import { formatGap, gapPx } from '../spineLayout';

describe('gapPx', () => {
  it('grows with the square root of elapsed days', () => {
    // The curve the spec settled on: a week still reads tighter than a month,
    // but a year is not fifty times a week.
    expect(Math.round(gapPx(7))).toBe(58);
    expect(Math.round(gapPx(14))).toBe(82);
    expect(Math.round(gapPx(30))).toBe(120);
    expect(Math.round(gapPx(90))).toBe(209);
    expect(Math.round(gapPx(365))).toBe(420);
  });

  it('floors short gaps so consecutive days cannot overlap', () => {
    // 44px is one row. Below four days the floor wins, which is the correct
    // reading anyway: "the same few days".
    expect(gapPx(0)).toBe(44);
    expect(gapPx(1)).toBe(44);
    expect(gapPx(3)).toBe(44);
    expect(Math.round(gapPx(4))).toBe(44);
  });

  it('never returns less than the floor for a negative gap', () => {
    // A moment dated before the one above it would otherwise draw upward.
    expect(gapPx(-30)).toBe(44);
  });
});

describe('formatGap', () => {
  it('counts in weeks below two months', () => {
    expect(formatGap(22)).toBe('3 weeks');
    expect(formatGap(49)).toBe('7 weeks');
  });

  it('counts in months up to two years', () => {
    expect(formatGap(56)).toBe('2 months');
    expect(formatGap(91)).toBe('3 months');
    // "12 months" rather than "1 year" on purpose: formatAgeParts already
    // switches to years at 24 months, and a parent of a small child thinks in
    // months well past twelve.
    expect(formatGap(365)).toBe('12 months');
    expect(formatGap(400)).toBe('13 months');
  });

  it('counts in years beyond that', () => {
    expect(formatGap(730)).toBe('2 years');
    expect(formatGap(1000)).toBe('3 years');
  });

  it('singularises', () => {
    expect(formatGap(7)).toBe('1 week');
  });
});
