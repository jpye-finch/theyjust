import { gapPx, layoutSpine } from '../spineLayout';
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

describe('layoutSpine date labels', () => {
  it('labels a row with its day and month', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-07-10', 'Later')],
    });
    expect(rows[1].dateLabel).toBe('10 Jul');
  });

  it('drops the date when it repeats the row above', () => {
    // Several moments on one day should read as one day carrying them all, not
    // as the same date stamped down the column.
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [
        moment('m1', '2025-07-10', 'First'),
        moment('m2', '2025-07-10', 'Second'),
        moment('m3', '2025-07-10', 'Third'),
      ],
    });
    expect(rows.map((r) => r.dateLabel)).toEqual(['22 May', '10 Jul', null, null]);
  });

  it('shows the year only where it changes', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [
        moment('m1', '2025-07-10', 'Same year as birth'),
        moment('m2', '2026-02-03', 'New year'),
        moment('m3', '2026-04-01', 'Still that year'),
      ],
    });
    expect(rows.map((r) => r.yearLabel)).toEqual(['2025', null, '2026', null]);
  });

  it('gives a repeated date no year either', () => {
    // The year belongs to the date that introduces it, and that date is absent.
    const rows = layoutSpine({
      dateOfBirth: '2025-12-31',
      dueDate: null,
      moments: [moment('m1', '2026-01-01', 'First'), moment('m2', '2026-01-01', 'Second')],
    });
    expect(rows[1].yearLabel).toBe('2026');
    expect(rows[2].dateLabel).toBeNull();
    expect(rows[2].yearLabel).toBeNull();
  });
});

describe('layoutSpine rules', () => {
  it('rules the spine as the months pass', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-08-22', 'Three months on')],
    });
    expect(rows[0].rules.map((r) => r.label)).toEqual(['1 month old', '2 months old']);
    // The 3-month rule lands exactly on the row below and is suppressed there.
  });

  it('places each rule proportionally within the gap', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-09-22', 'Four months on')],
    });
    const threeMonths = rows[0].rules.find((r) => r.label === '3 months old');
    // 22/08 sits 92 of 123 days along, so about three quarters down the gap.
    expect(threeMonths!.offset / rows[0].height).toBeCloseTo(92 / 123, 2);
  });

  it('rules every month of a long gap, leaving no holes in the sequence', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-09-22', 'Four months on')],
    });
    // A missing month in an otherwise regular run reads as a bug, so nothing is
    // dropped except where it would collide with a row.
    expect(rows[0].rules.map((r) => r.label)).toEqual([
      '1 month old',
      '2 months old',
      '3 months old',
    ]);
  });

  it('switches from months to years at two', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      // Deliberately NOT dated on a birthday: a rule falling exactly on the row
      // below is suppressed by the clearance check, so a moment on 22/05/2028
      // would hide the very "3 years old" rule this test is about.
      moments: [moment('m1', '2028-08-22', 'Three years on')],
    });
    const labels = rows[0].rules.map((r) => r.label);
    expect(labels).toContain('2 years old');
    expect(labels).toContain('3 years old');
    expect(labels).not.toContain('25 months old');
  });

  it('suppresses a rule that would crowd the row above it', () => {
    // 22/06 falls in the two-day gap between these moments, so its rule would
    // draw straight across the title of the row above. A row's head is 44px of
    // type, not a hairline, so the clearance has to account for it.
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-06-21', 'Just before'), moment('m2', '2025-06-23', 'Just after')],
    });
    expect(rows[1].rules).toEqual([]);
  });

  it('rules by corrected age for a premature baby', () => {
    // Born six weeks early: "1 month old" belongs a month after the DUE date,
    // which is 03/08 — 73 of the 102 days to the moment below.
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: '2025-07-03',
      moments: [moment('m1', '2025-09-01', 'Later')],
    });
    const oneMonth = rows[0].rules.find((r) => r.label === '1 month old');
    expect(oneMonth!.offset / rows[0].height).toBeCloseTo(73 / 102, 2);
  });

  it('gives the last row no rules', () => {
    const rows = layoutSpine({ dateOfBirth: BIRTH, dueDate: null, moments: [moment('m1', '2025-06-01', 'A')] });
    expect(rows[1].rules).toEqual([]);
  });
});
