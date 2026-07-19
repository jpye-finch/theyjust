import { formatGap, gapPx, layoutSpine } from '../spineLayout';
import type { Moment } from '../momentQueries';

const moment = (id: string, occurredOn: string, title: string): Moment => ({
  id,
  child_id: 'c1',
  milestone_id: null,
  custom_title: title,
  occurred_on: occurredOn,
  note: null,
  logged_by: 'u1',
  created_at: `${occurredOn}T00:00:00.000Z`,
  moment_photos: [],
});

const BIRTH = '2025-05-22';

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

describe('layoutSpine rows', () => {
  it('anchors every spine at birth, even before anything is logged', () => {
    const rows = layoutSpine({ dateOfBirth: BIRTH, dueDate: null, moments: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('born');
    expect(rows[0].title).toBe('Born');
    expect(rows[0].date).toBe(BIRTH);
    expect(rows[0].momentId).toBeNull();
  });

  it('reads downward through time, whatever order it is given', () => {
    // fetchTimeline hands back newest-first; the spine must not inherit that.
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m2', '2025-06-10', 'Later'), moment('m1', '2025-05-29', 'Sooner')],
    });
    expect(rows.map((r) => r.title)).toEqual(['Born', 'Sooner', 'Later']);
  });

  it('gives each row the height of the gap that follows it', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-05-29', 'A week later')],
    });
    // Born -> m1 is 7 days.
    expect(Math.round(rows[0].height)).toBe(58);
    // The last row has no gap to express, so it is just a row.
    expect(rows[1].height).toBe(44);
  });

  it('stacks offsets so getItemLayout can be O(1)', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-05-29', 'A'), moment('m2', '2025-06-05', 'B')],
    });
    expect(rows[0].offset).toBe(0);
    expect(rows[1].offset).toBe(rows[0].height);
    expect(rows[2].offset).toBe(rows[0].height + rows[1].height);
  });

  it('clamps a moment dated before birth instead of drawing backwards', () => {
    // The date picker does not forbid this today.
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-01-01', 'Impossible')],
    });
    expect(rows[0].height).toBe(44);
    expect(rows[1].offset).toBe(44);
  });

  it('resolves the celebration title for a catalogue milestone', () => {
    const milestone: Moment = { ...moment('m1', '2025-11-01', ''), milestone_id: 'crawled', custom_title: null };
    const rows = layoutSpine({ dateOfBirth: BIRTH, dueDate: null, moments: [milestone] });
    expect(rows[1].title).toBe('They just crawled!');
  });

  it('carries the moment id so a row can open its moment', () => {
    const rows = layoutSpine({ dateOfBirth: BIRTH, dueDate: null, moments: [moment('m1', '2025-06-01', 'A')] });
    expect(rows[1].momentId).toBe('m1');
    expect(rows[1].key).toBe('m1');
  });
});
