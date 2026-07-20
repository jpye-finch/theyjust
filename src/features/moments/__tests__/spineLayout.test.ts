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

  it('reads newest first, whatever order it is given', () => {
    // Matches the list view, and puts today at the top where you open the app.
    // Born anchors the BOTTOM: the beginning you scroll back to.
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-05-29', 'Sooner'), moment('m2', '2025-06-10', 'Later')],
    });
    expect(rows.map((r) => r.title)).toEqual(['Later', 'Sooner', 'Born']);
  });

  it('gives each row the height of the gap that follows it', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-05-29', 'A week later')],
    });
    // m1 -> Born is 7 days, measured downward from the newer row.
    expect(Math.round(rows[0].height)).toBe(58);
    // The last row (Born) has no gap below it to express, so it is just a row.
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

  it('resolves the recorded title for a catalogue milestone', () => {
    const milestone: Moment = { ...moment('m1', '2025-11-01', ''), milestone_id: 'crawled', custom_title: null };
    const rows = layoutSpine({ dateOfBirth: BIRTH, dueDate: null, moments: [milestone] });
    expect(rows[0].title).toBe('Crawled');
  });

  it('carries the moment id so a row can open its moment', () => {
    const rows = layoutSpine({ dateOfBirth: BIRTH, dueDate: null, moments: [moment('m1', '2025-06-01', 'A')] });
    expect(rows[0].momentId).toBe('m1');
    expect(rows[0].key).toBe('m1');
  });
});

describe('layoutSpine date labels', () => {
  it('labels a row with its day and month', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-07-10', 'Later')],
    });
    expect(rows[0].dateLabel).toBe('10 Jul');
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
    // Dividers carry no date of their own, so compare only the rows that do.
    const dated = rows.filter((r) => r.kind !== 'rule');
    expect(dated.map((r) => r.dateLabel)).toEqual(['10 Jul', null, null, '22 May']);
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
    const dated = rows.filter((r) => r.kind !== 'rule');
    expect(dated.map((r) => r.yearLabel)).toEqual(['2026', null, '2025', null]);
  });

  it('gives a repeated date no year either', () => {
    // The year belongs to the date that introduces it, and that date is absent.
    const rows = layoutSpine({
      dateOfBirth: '2025-12-31',
      dueDate: null,
      moments: [moment('m1', '2026-01-01', 'First'), moment('m2', '2026-01-01', 'Second')],
    });
    expect(rows[0].yearLabel).toBe('2026');
    expect(rows[1].dateLabel).toBeNull();
    expect(rows[1].yearLabel).toBeNull();
  });
});

describe('layoutSpine age dividers', () => {
  const dividers = (rows: ReturnType<typeof layoutSpine>) =>
    rows.filter((r) => r.kind === 'rule').map((r) => r.title);

  it('marks every month between birth and the newest moment', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-09-22', 'Four months on')],
    });
    // Newest first, so the dividers count down as you scroll back in time.
    expect(dividers(rows)).toEqual(['4 months old', '3 months old', '2 months old', '1 month old']);
  });

  it('keeps the cadence through a dense stretch', () => {
    // Dividers used to be positioned inside the gap between two moments, so a
    // busy month lost its divider entirely — the rhythm broke exactly where the
    // most was happening. They are rows now and cannot be crowded out.
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [
        moment('m1', '2025-06-21', 'Just before'),
        moment('m2', '2025-06-23', 'Just after'),
      ],
    });
    expect(dividers(rows)).toEqual(['1 month old']);
  });

  it('gives a divider its own place in the order', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [
        moment('m1', '2025-06-21', 'Before the month turns'),
        moment('m2', '2025-06-23', 'After it turns'),
      ],
    });
    expect(rows.map((r) => r.title)).toEqual([
      'After it turns',
      '1 month old',
      'Before the month turns',
      'Born',
    ]);
  });

  it('switches from months to years at two', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2028-11-22', 'Three and a half years on')],
    });
    const labels = dividers(rows);
    expect(labels).toContain('2 years old');
    expect(labels).toContain('3 years old');
    expect(labels).not.toContain('25 months old');
  });

  it('rules by corrected age for a premature baby', () => {
    // Born six weeks early: "1 month old" belongs a month after the DUE date,
    // which is 03/08 rather than 22/06.
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: '2025-07-03',
      moments: [moment('m1', '2025-09-01', 'Later')],
    });
    const oneMonth = rows.find((r) => r.title === '1 month old');
    expect(oneMonth!.date).toBe('2025-08-03');
  });

  it('carries no date of its own, so the date column skips it', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-09-22', 'Four months on')],
    });
    const divider = rows.find((r) => r.kind === 'rule')!;
    expect(divider.dateLabel).toBeNull();
    expect(divider.yearLabel).toBeNull();
    expect(divider.momentId).toBeNull();
  });

  it('draws no dividers before there is anything to divide', () => {
    const rows = layoutSpine({ dateOfBirth: BIRTH, dueDate: null, moments: [] });
    expect(dividers(rows)).toEqual([]);
  });
});
