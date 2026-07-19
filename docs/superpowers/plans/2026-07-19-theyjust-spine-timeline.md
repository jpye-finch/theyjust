# Spine Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second Timeline view where vertical distance is elapsed time, so a burst of development reads as a tight cluster and a quiet stretch reads as measured space.

**Architecture:** All the maths lives in one pure module, `spineLayout.ts`, which turns moments into positioned rows carrying their own trailing space, age rules and gap captions — so the curve, the suppression rules and the anchor can all be proved without mounting a component. Each row's height is the gap that *follows* it, which keeps the view an ordinary `FlatList` with `getItemLayout` rather than absolute positioning.

**Tech Stack:** Expo SDK 57, React Native, jest-expo + RNTL v14, AsyncStorage.

---

## Spec

`docs/superpowers/specs/2026-07-19-theyjust-spine-timeline-design.md` (approved 2026-07-19). Read it before starting — this plan implements it and does not restate its reasoning.

## Context an implementer needs

- `npm test` pins `TZ=America/Los_Angeles`; a bare `npx jest` uses the host zone. Always use `npm test`.
- Local `tsc` needs `rm -f .expo/types/router.d.ts` first; `tsconfig.json` excludes `supabase/functions`.
- **Never run `npm run lint`** — the project has no eslint config, and Expo's lint command scaffolds one and installs dependencies, contaminating the tree.
- RNTL v14: `render` and `renderHook` are **async — await them**. `getByText` matches a `Text`'s *full* string, so assert whole lines.
- Imports: `@/theme/tokens` and `@/components/...` even inside `src/features` (established pattern — see `MomentCard.tsx`); relative for same-feature and cross-feature modules.
- `fetchTimeline` returns moments **newest-first**. The spine reads downward through time, so `layoutSpine` sorts oldest-first itself. Do not assume input order.
- Dates are ISO `YYYY-MM-DD` strings. Parse them as UTC (`new Date(\`${iso}T00:00:00Z\`)`), exactly as `src/features/children/age.ts` does — a device timezone must never shift a stored date.
- Local Supabase must be running (`npx supabase start`) or every screen past sign-in fails with a bare `Failed to fetch`.

## File structure

| File | Responsibility |
|---|---|
| `src/features/moments/spineLayout.ts` | pure: moments in, positioned rows + rules + captions out |
| `src/features/moments/SpineRow.tsx` | one row: date, dot, title, thumbnail, trailing space |
| `src/features/moments/SpineTimeline.tsx` | the FlatList and its `getItemLayout` |
| `src/features/moments/TimelineHeader.tsx` | brand, child line, view toggle, capture button |
| `src/features/moments/timelineView.ts` | the persisted list/spine preference |
| `src/lib/date.ts` | gains `formatShortDate` (dd/mm/yyyy) |
| `src/app/(app)/(tabs)/index.tsx` | picks the view; header moves out of the list |

**One deliberate behaviour change.** The header currently lives in the list's `ListHeaderComponent` and scrolls away. It moves out, above both views, and becomes fixed. Two reasons: a view toggle that scrolls out of reach is a poor switcher, and `getItemLayout` offsets cannot account for a variable-height header without the classic off-by-a-header bug. Flag it when you demo — it changes how the existing list feels.

---

### Task 1: The scale curve and the gap formatter (TDD)

Two pure functions, no dates and no rendering. Everything else builds on them.

**Files:**
- Create: `src/features/moments/spineLayout.ts`
- Test: `src/features/moments/__tests__/spineLayout.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/moments/__tests__/spineLayout.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- spineLayout
```

Expected: FAIL, `Cannot find module '../spineLayout'`.

- [ ] **Step 3: Implement `src/features/moments/spineLayout.ts`**

```ts
// Vertical distance on the spine IS elapsed time. A square-root curve is what
// makes that survive five years: gaps keep growing, but ever more slowly, so a
// quiet year does not become thousands of pixels of empty scroll.

const MIN_GAP = 44;
const K = 22;

/** Pixels of spine for a gap of `days`. Floored at one row height. */
export function gapPx(days: number): number {
  return Math.max(MIN_GAP, Math.sqrt(Math.max(0, days)) * K);
}

const DAYS_PER_MONTH = 30.4375;
const DAYS_PER_YEAR = 365.25;

/** A duration in one coarse unit, for a caption read while scrolling. */
export function formatGap(days: number): string {
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `${weeks} week${weeks === 1 ? '' : 's'}`;
  const months = Math.round(days / DAYS_PER_MONTH);
  if (months < 24) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.round(days / DAYS_PER_YEAR);
  return `${years} year${years === 1 ? '' : 's'}`;
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm test -- spineLayout && rm -f .expo/types/router.d.ts && npx tsc --noEmit
```

Expected: 7 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/moments/spineLayout.ts src/features/moments/__tests__/spineLayout.test.ts
git commit -m "feat: spine scale curve and gap formatter"
```

---

### Task 2: Rows, offsets and the Born anchor (TDD)

**Files:**
- Modify: `src/features/moments/spineLayout.ts`
- Modify: `src/features/moments/__tests__/spineLayout.test.ts`

- [ ] **Step 1: Add the failing tests.** Append to the test file, and add the import at the top:

```ts
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
```

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- spineLayout
```

Expected: FAIL, `layoutSpine is not a function`.

- [ ] **Step 3: Add the types and `layoutSpine`.** Append to `src/features/moments/spineLayout.ts`:

```ts
import type { Moment } from './momentQueries';
import { momentTitle } from './momentText';

const MS_PER_DAY = 86_400_000;

export type SpineMark = { label: string; offset: number };

export type SpineRow = {
  key: string;
  kind: 'born' | 'moment';
  momentId: string | null;
  date: string;
  title: string;
  /** This row's own height: the gap that FOLLOWS it. */
  height: number;
  /** Absolute distance from the top, so getItemLayout stays O(1). */
  offset: number;
  rules: SpineMark[];
  gapCaption: SpineMark | null;
};

export type SpineInput = {
  dateOfBirth: string;
  dueDate: string | null;
  moments: Moment[];
};

// Dates are read as UTC calendar days, exactly as age.ts does: a device
// timezone must never shift a stored date.
function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / MS_PER_DAY);
}

export function layoutSpine({ dateOfBirth, dueDate, moments }: SpineInput): SpineRow[] {
  // fetchTimeline returns newest-first; the spine reads downward through time.
  const ordered = [...moments].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));

  const entries = [
    { key: 'born', kind: 'born' as const, momentId: null, date: dateOfBirth, title: 'Born' },
    ...ordered.map((m) => ({
      key: m.id,
      kind: 'moment' as const,
      momentId: m.id,
      date: m.occurred_on,
      title: momentTitle(m),
    })),
  ];

  const rows: SpineRow[] = [];
  let offset = 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const next = entries[i + 1];
    // Negative means a moment dated before the one above it — clamp rather than
    // draw upward through the row before.
    const gapDays = next ? Math.max(0, daysBetween(entry.date, next.date)) : 0;
    const height = next ? gapPx(gapDays) : MIN_GAP;

    rows.push({ ...entry, height, offset, rules: [], gapCaption: null });
    offset += height;
  }
  return rows;
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm test -- spineLayout && rm -f .expo/types/router.d.ts && npx tsc --noEmit
```

Expected: 14 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/moments/spineLayout.ts src/features/moments/__tests__/spineLayout.test.ts
git commit -m "feat: spine rows, stacked offsets and the Born anchor"
```

---

### Task 3: Age rules and gap captions (TDD)

The two devices that turn a proportional spine from a feeling into a measurement.

**Files:**
- Modify: `src/features/moments/spineLayout.ts`
- Modify: `src/features/moments/__tests__/spineLayout.test.ts`

- [ ] **Step 1: Add the failing tests.** Append to the test file:

```ts
describe('layoutSpine rules and captions', () => {
  it('captions a gap longer than three weeks', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-07-10', 'Seven weeks on')],
    });
    // 49 days from birth.
    expect(rows[0].gapCaption?.label).toBe('7 weeks');
    // Centred in its own trailing space, which for a gap this size clears the head.
    expect(rows[0].gapCaption?.offset).toBeCloseTo(rows[0].height / 2);
  });

  it('keeps the caption clear of the row above on a short gap', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-06-13', 'Three weeks on')],
    });
    // 22 days is 103px, so the centre would be 51px — inside the 44px head.
    expect(rows[0].gapCaption?.label).toBe('3 weeks');
    expect(rows[0].gapCaption?.offset).toBe(56);
  });

  it('leaves short gaps uncaptioned', () => {
    // Under three weeks the spacing already says it; a caption would be noise.
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-06-05', 'A fortnight on')],
    });
    expect(rows[0].gapCaption).toBeNull();
  });

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

  it('drops a rule that would land on the gap caption', () => {
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
      moments: [moment('m1', '2025-09-22', 'Four months on')],
    });
    // Over 123 days the caption sits at 122px and the 2-month rule at 121px.
    // Two labels a pixel apart is worse than one, so the rule gives way.
    expect(rows[0].rules.map((r) => r.label)).toEqual(['1 month old', '3 months old']);
  });

  it('switches from months to years at two', () => {
    // Deliberately NOT dated on a birthday: a rule falling exactly on the row
    // below is suppressed by the clearance check, so a moment on 22/05/2028
    // would hide the very "3 years old" rule this test is about.
    const rows = layoutSpine({
      dateOfBirth: BIRTH,
      dueDate: null,
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

  it('gives the last row no rules or caption', () => {
    const rows = layoutSpine({ dateOfBirth: BIRTH, dueDate: null, moments: [moment('m1', '2025-06-01', 'A')] });
    expect(rows[1].rules).toEqual([]);
    expect(rows[1].gapCaption).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- spineLayout
```

Expected: FAIL — `rows[0].gapCaption` is null and `rows[0].rules` is empty.

- [ ] **Step 3: Implement.** Add the constants and helpers to `src/features/moments/spineLayout.ts`, importing `formatAgeParts`:

```ts
import { formatAgeParts } from '../children/age';
```

```ts
const CAPTION_MIN_DAYS = 21;
const CLEARANCE = 16;
const MONTHLY_RULES_THROUGH = 24;
const OLDEST_RULED_YEAR = 18;

/** Height of a row's head — the date, dot, title and thumbnail. Anything placed
 *  in the trailing space must clear it, or it draws over the title. */
export const ROW_HEAD = 44;

/** from + n months, clamping to the last day of the target month. */
function addMonths(iso: string, n: number): string {
  const d = toUtc(iso);
  const firstOfTarget = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const daysInTarget = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      firstOfTarget.getUTCFullYear(),
      firstOfTarget.getUTCMonth(),
      Math.min(d.getUTCDate(), daysInTarget),
    ),
  )
    .toISOString()
    .slice(0, 10);
}

// Monthly through 24 months, then each birthday. 24 is not arbitrary: it is the
// corrected-age cutoff and the point where formatAgeParts itself stops counting
// in months, so the ruler changes unit where the rest of the app already does.
function ruleDates(origin: string): { label: string; date: string }[] {
  const marks: { label: string; date: string }[] = [];
  for (let n = 1; n <= MONTHLY_RULES_THROUGH; n++) {
    marks.push({ label: `${formatAgeParts({ months: n, weeks: 0 })} old`, date: addMonths(origin, n) });
  }
  for (let year = 3; year <= OLDEST_RULED_YEAR; year++) {
    marks.push({
      label: `${formatAgeParts({ months: year * 12, weeks: 0 })} old`,
      date: addMonths(origin, year * 12),
    });
  }
  return marks;
}

function rulesInGap(
  origin: string,
  from: string,
  to: string,
  gapDays: number,
  height: number,
  caption: SpineMark | null,
): SpineMark[] {
  if (gapDays <= 0) return [];
  return ruleDates(origin)
    .filter((mark) => mark.date > from && mark.date <= to)
    .map((mark) => ({ label: mark.label, offset: (daysBetween(from, mark.date) / gapDays) * height }))
    .filter(
      (mark) =>
        // Clear of the head above (which is 44px of type, not a hairline), the
        // row below, and the caption between them.
        mark.offset >= ROW_HEAD + CLEARANCE &&
        height - mark.offset >= CLEARANCE &&
        (caption === null || Math.abs(mark.offset - caption.offset) >= CLEARANCE),
    );
}

/** Centred in the gap, but never inside the head of the row above it. */
function captionOffset(height: number): number {
  return Math.max(ROW_HEAD + 12, height / 2);
}
```

Then replace the body of the `for` loop in `layoutSpine` so rules and captions are computed, and add the ruler origin above the loop:

```ts
  // The ruler follows corrected age when there is a due date: for a premature
  // baby "1 month old" belongs a month after the date they were due. One origin
  // throughout — a ruler that changed its own origin mid-scroll would be worse
  // than one that is consistently corrected.
  const rulerOrigin = dueDate ?? dateOfBirth;

  const rows: SpineRow[] = [];
  let offset = 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const next = entries[i + 1];
    const gapDays = next ? Math.max(0, daysBetween(entry.date, next.date)) : 0;
    const height = next ? gapPx(gapDays) : MIN_GAP;

    const gapCaption =
      next && gapDays > CAPTION_MIN_DAYS
        ? { label: formatGap(gapDays), offset: captionOffset(height) }
        : null;
    const rules = next
      ? rulesInGap(rulerOrigin, entry.date, next.date, gapDays, height, gapCaption)
      : [];

    rows.push({ ...entry, height, offset, rules, gapCaption });
    offset += height;
  }
  return rows;
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm test -- spineLayout && rm -f .expo/types/router.d.ts && npx tsc --noEmit
```

Expected: 24 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/moments/spineLayout.ts src/features/moments/__tests__/spineLayout.test.ts
git commit -m "feat: age rules and gap captions on the spine"
```

---

### Task 4: The short date format and the row (TDD)

**Files:**
- Modify: `src/lib/date.ts`
- Modify: `src/lib/__tests__/date.test.ts`
- Create: `src/features/moments/SpineRow.tsx`
- Test: `src/features/moments/__tests__/SpineRow.test.tsx`

- [ ] **Step 1: Add the failing date test.** Append to `src/lib/__tests__/date.test.ts`, adding `formatShortDate` to the existing import from `../date`:

```ts
describe('formatShortDate', () => {
  it('renders a stored date as dd/mm/yyyy', () => {
    expect(formatShortDate('2026-07-08')).toBe('08/07/2026');
  });

  it('zero-pads single digits', () => {
    expect(formatShortDate('2025-01-05')).toBe('05/01/2025');
  });

  it('returns the raw value when it is not a date', () => {
    // Same defensive contract as formatDisplayDate: never render "NaN".
    expect(formatShortDate('nonsense')).toBe('nonsense');
  });
});
```

- [ ] **Step 2: Implement it.** Append to `src/lib/date.ts`:

```ts
// dd/mm/yyyy for the spine's date column, where a narrow fixed-width date keeps
// the column aligned. Parsed by string rather than Date, so a timezone can never
// shift the day.
export function formatShortDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
```

- [ ] **Step 3: Write the failing row tests.** Create `src/features/moments/__tests__/SpineRow.test.tsx`:

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import { SpineRow } from '../SpineRow';
import type { SpineRow as Row } from '../spineLayout';

const row: Row = {
  key: 'm1',
  kind: 'moment',
  momentId: 'm1',
  date: '2026-07-08',
  title: 'They just crawled!',
  height: 120,
  offset: 0,
  rules: [],
  gapCaption: null,
};

describe('SpineRow', () => {
  it('shows the date and the title', async () => {
    await render(<SpineRow row={row} photoUrl={null} onPress={jest.fn()} />);
    expect(screen.getByText('08/07/2026')).toBeTruthy();
    expect(screen.getByText('They just crawled!')).toBeTruthy();
  });

  it('shows a thumbnail only when the moment has one', async () => {
    const { rerender } = await render(<SpineRow row={row} photoUrl={null} onPress={jest.fn()} />);
    expect(screen.queryByTestId('spine-thumb')).toBeNull();

    rerender(<SpineRow row={row} photoUrl="https://example.test/a.jpg" onPress={jest.fn()} />);
    expect(screen.getByTestId('spine-thumb').props.source).toEqual({
      uri: 'https://example.test/a.jpg',
    });
  });

  it('opens the moment when tapped', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<SpineRow row={row} photoUrl={null} onPress={onPress} />);
    await user.press(screen.getByText('They just crawled!'));
    expect(onPress).toHaveBeenCalled();
  });

  it('renders the rules and the caption that fall in its trailing space', async () => {
    await render(
      <SpineRow
        row={{
          ...row,
          rules: [{ label: '1 month old', offset: 40 }],
          gapCaption: { label: '7 weeks', offset: 60 },
        }}
        photoUrl={null}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText('1 month old')).toBeTruthy();
    expect(screen.getByText('7 weeks')).toBeTruthy();
  });

  it('does not offer the Born anchor as something to open', async () => {
    // There is no moment behind it, so it must not look tappable.
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <SpineRow
        row={{ ...row, key: 'born', kind: 'born', momentId: null, title: 'Born' }}
        photoUrl={null}
        onPress={onPress}
      />,
    );
    await user.press(screen.getByText('Born'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run to verify both fail**

```bash
npm test -- date SpineRow
```

Expected: date FAILs on `formatShortDate` being undefined only if Step 2 was skipped; SpineRow FAILs with `Cannot find module '../SpineRow'`.

- [ ] **Step 5: Implement `src/features/moments/SpineRow.tsx`**

```tsx
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatShortDate } from '@/lib/date';
import { color, font, radius, space, type } from '@/theme/tokens';
import { ROW_HEAD, type SpineRow as Row } from './spineLayout';

type Props = {
  row: Row;
  photoUrl: string | null;
  onPress: () => void;
};

const DOT_SIZE = 9;
const SPINE_LEFT = 74;

export function SpineRow({ row, photoUrl, onPress }: Props) {
  const openable = row.momentId !== null;
  return (
    // The row's height IS the gap that follows it, so the empty stretch below
    // the head is the elapsed time, and the rules and caption live inside it.
    <View style={[styles.row, { height: row.height }]}>
      <View style={styles.spine} />

      {row.rules.map((rule) => (
        <View key={rule.label} style={[styles.rule, { top: rule.offset }]}>
          <View style={styles.ruleLine} />
          <Text style={styles.ruleLabel}>{rule.label}</Text>
          <View style={styles.ruleLine} />
        </View>
      ))}

      {row.gapCaption ? (
        <Text style={[styles.caption, { top: row.gapCaption.offset }]}>{row.gapCaption.label}</Text>
      ) : null}

      <Pressable
        style={styles.head}
        onPress={openable ? onPress : undefined}
        disabled={!openable}
        accessibilityRole={openable ? 'button' : undefined}
      >
        <Text style={styles.date}>{formatShortDate(row.date)}</Text>
        <View style={styles.dot} />
        <Text style={styles.title} numberOfLines={2}>
          {row.title}
        </Text>
        {photoUrl ? (
          <Image
            testID="spine-thumb"
            accessible={false}
            source={{ uri: photoUrl }}
            style={styles.thumb}
            resizeMode="cover"
          />
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'relative' },
  spine: {
    position: 'absolute',
    left: SPINE_LEFT,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: color.ink,
    opacity: 0.35,
  },
  // ROW_HEAD, not a local 44: the layout module suppresses rules that would fall
  // inside this head, so the two must never drift apart.
  head: { flexDirection: 'row', alignItems: 'center', height: ROW_HEAD, paddingRight: space.lg },
  date: {
    width: 64,
    textAlign: 'right',
    fontFamily: font.body,
    fontSize: type.caption,
    color: color.inkMuted,
    // Tabular figures keep the date column from shuffling as the digits change.
    fontVariant: ['tabular-nums'],
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: color.ink,
    marginLeft: SPINE_LEFT - 64 - DOT_SIZE / 2,
  },
  title: {
    flex: 1,
    marginLeft: space.md,
    fontFamily: font.display,
    fontSize: type.label,
    color: color.ink,
  },
  thumb: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: color.paperRaise },
  rule: { position: 'absolute', left: 0, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ruleLine: { flex: 1, height: 1, backgroundColor: color.rule },
  ruleLabel: { fontFamily: font.medium, fontSize: type.caption, color: color.inkMuted },
  caption: {
    position: 'absolute',
    left: SPINE_LEFT + space.md,
    fontFamily: font.body,
    fontSize: type.caption,
    color: color.inkMuted,
    fontStyle: 'italic',
  },
});
```

- [ ] **Step 6: Run to verify they pass**

```bash
npm test -- date SpineRow && rm -f .expo/types/router.d.ts && npx tsc --noEmit
```

Expected: date 3 new tests pass; SpineRow 5 passed; tsc exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/date.ts src/lib/__tests__/date.test.ts src/features/moments/SpineRow.tsx src/features/moments/__tests__/SpineRow.test.tsx
git commit -m "feat: spine row and the dd/mm/yyyy date format"
```

---

### Task 5: The spine list (TDD)

**Files:**
- Create: `src/features/moments/SpineTimeline.tsx`
- Test: `src/features/moments/__tests__/SpineTimeline.test.tsx`

- [ ] **Step 1: Write the failing tests.** Create `src/features/moments/__tests__/SpineTimeline.test.tsx`:

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import type { Moment } from '../momentQueries';
import { SpineTimeline } from '../SpineTimeline';

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

describe('SpineTimeline', () => {
  it('draws the anchor and every moment, oldest first', async () => {
    await render(
      <SpineTimeline
        dateOfBirth="2025-05-22"
        dueDate={null}
        moments={[moment('m2', '2025-07-10', 'Later'), moment('m1', '2025-05-29', 'Sooner')]}
        photoUrls={{}}
        onOpenMoment={jest.fn()}
      />,
    );
    expect(screen.getByText('Born')).toBeTruthy();
    expect(screen.getByText('Sooner')).toBeTruthy();
    expect(screen.getByText('Later')).toBeTruthy();
  });

  it('opens the moment that was tapped', async () => {
    const onOpenMoment = jest.fn();
    const user = userEvent.setup();
    await render(
      <SpineTimeline
        dateOfBirth="2025-05-22"
        dueDate={null}
        moments={[moment('m1', '2025-05-29', 'Sooner')]}
        photoUrls={{}}
        onOpenMoment={onOpenMoment}
      />,
    );
    await user.press(screen.getByText('Sooner'));
    expect(onOpenMoment).toHaveBeenCalledWith('m1');
  });

  it('passes each moment its own photo', async () => {
    await render(
      <SpineTimeline
        dateOfBirth="2025-05-22"
        dueDate={null}
        moments={[moment('m1', '2025-05-29', 'Sooner')]}
        photoUrls={{ m1: 'https://example.test/a.jpg' }}
        onOpenMoment={jest.fn()}
      />,
    );
    expect(screen.getByTestId('spine-thumb').props.source).toEqual({
      uri: 'https://example.test/a.jpg',
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- SpineTimeline
```

Expected: FAIL, `Cannot find module '../SpineTimeline'`.

- [ ] **Step 3: Implement `src/features/moments/SpineTimeline.tsx`**

```tsx
import { useMemo } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { color, space } from '@/theme/tokens';
import type { Moment } from './momentQueries';
import { layoutSpine, type SpineRow as Row } from './spineLayout';
import { SpineRow } from './SpineRow';

type Props = {
  dateOfBirth: string;
  dueDate: string | null;
  moments: Moment[];
  photoUrls: Record<string, string>;
  onOpenMoment: (momentId: string) => void;
};

export function SpineTimeline({ dateOfBirth, dueDate, moments, photoUrls, onOpenMoment }: Props) {
  const rows = useMemo(
    () => layoutSpine({ dateOfBirth, dueDate, moments }),
    [dateOfBirth, dueDate, moments],
  );

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(row) => row.key}
      // Every row's height is already known, so the list never has to measure
      // and scrolling stays O(1) across a five-year spine.
      getItemLayout={(_, index) => ({
        length: rows[index].height,
        offset: rows[index].offset,
        index,
      })}
      renderItem={({ item }: { item: Row }) => (
        <SpineRow
          row={item}
          photoUrl={(item.momentId && photoUrls[item.momentId]) || null}
          onPress={() => item.momentId && onOpenMoment(item.momentId)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: color.paper },
  content: { paddingTop: space.sm, paddingBottom: space.xxl },
});
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm test -- SpineTimeline && rm -f .expo/types/router.d.ts && npx tsc --noEmit
```

Expected: 3 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/moments/SpineTimeline.tsx src/features/moments/__tests__/SpineTimeline.test.tsx
git commit -m "feat: the spine list, with known row heights"
```

---

### Task 6: Remembering the chosen view (TDD)

**Files:**
- Create: `src/features/moments/timelineView.ts`
- Test: `src/features/moments/__tests__/timelineView.test.ts`

- [ ] **Step 1: Write the failing tests.** Create `src/features/moments/__tests__/timelineView.test.ts`:

```ts
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTimelineView } from '../timelineView';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedStorage.setItem.mockResolvedValue(undefined);
});

describe('useTimelineView', () => {
  it('starts on the list, which is the reading view', async () => {
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useTimelineView());
    await waitFor(() => expect(result.current.view).toBe('list'));
  });

  it('restores the spine when that was the last choice', async () => {
    mockedStorage.getItem.mockResolvedValue('spine');
    const { result } = await renderHook(() => useTimelineView());
    await waitFor(() => expect(result.current.view).toBe('spine'));
  });

  it('remembers a change', async () => {
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useTimelineView());
    await waitFor(() => expect(result.current.view).toBe('list'));

    act(() => result.current.setView('spine'));

    await waitFor(() => expect(result.current.view).toBe('spine'));
    expect(mockedStorage.setItem).toHaveBeenCalledWith('timeline-view', 'spine');
  });

  it('ignores a stored value it does not recognise', async () => {
    // A corrupt or downgraded value must not render an unknown view.
    mockedStorage.getItem.mockResolvedValue('carousel');
    const { result } = await renderHook(() => useTimelineView());
    await waitFor(() => expect(result.current.view).toBe('list'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- timelineView
```

Expected: FAIL, `Cannot find module '../timelineView'`.

- [ ] **Step 3: Implement `src/features/moments/timelineView.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type TimelineView = 'list' | 'spine';

const STORAGE_KEY = 'timeline-view';

// The list is the default: it is the reading view, carrying notes and full
// photos. The spine is the overview a parent opts into.
const DEFAULT_VIEW: TimelineView = 'list';

export function useTimelineView(): {
  view: TimelineView;
  setView: (next: TimelineView) => void;
} {
  const [view, setLocalView] = useState<TimelineView>(DEFAULT_VIEW);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      // Anything unrecognised falls back rather than rendering an unknown view.
      if (!cancelled && (stored === 'list' || stored === 'spine')) setLocalView(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setView = (next: TimelineView) => {
    setLocalView(next);
    // Fire and forget: the toggle must not wait on disk to feel instant.
    void AsyncStorage.setItem(STORAGE_KEY, next);
  };

  return { view, setView };
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm test -- timelineView && rm -f .expo/types/router.d.ts && npx tsc --noEmit
```

Expected: 4 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/moments/timelineView.ts src/features/moments/__tests__/timelineView.test.ts
git commit -m "feat: remember whether the parent last used the list or the spine"
```

---

### Task 7: The header, the toggle, and choosing the view

The header moves out of the list's `ListHeaderComponent` so it sits above both views. That makes it fixed rather than scrolling away — deliberate, because a view toggle that scrolls out of reach is a poor switcher, and because `getItemLayout` offsets cannot account for a variable-height header.

**Files:**
- Create: `src/features/moments/TimelineHeader.tsx`
- Test: `src/features/moments/__tests__/TimelineHeader.test.tsx`
- Modify: `src/app/(app)/(tabs)/index.tsx`

- [ ] **Step 1: Write the failing header tests.** Create `src/features/moments/__tests__/TimelineHeader.test.tsx`:

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import { TimelineHeader } from '../TimelineHeader';

describe('TimelineHeader', () => {
  it('names the child whose story it is', async () => {
    await render(
      <TimelineHeader
        childName="Mabel"
        view="list"
        onSelectView={jest.fn()}
        onCapture={jest.fn()}
      />,
    );
    expect(screen.getByText('TheyJust')).toBeTruthy();
    expect(screen.getByText("Mabel's story")).toBeTruthy();
  });

  it('switches to the spine', async () => {
    const onSelectView = jest.fn();
    const user = userEvent.setup();
    await render(
      <TimelineHeader
        childName="Mabel"
        view="list"
        onSelectView={onSelectView}
        onCapture={jest.fn()}
      />,
    );
    await user.press(screen.getByLabelText('Timeline view'));
    expect(onSelectView).toHaveBeenCalledWith('spine');
  });

  it('switches back to the list', async () => {
    const onSelectView = jest.fn();
    const user = userEvent.setup();
    await render(
      <TimelineHeader
        childName="Mabel"
        view="spine"
        onSelectView={onSelectView}
        onCapture={jest.fn()}
      />,
    );
    await user.press(screen.getByLabelText('List view'));
    expect(onSelectView).toHaveBeenCalledWith('list');
  });

  it('still opens capture', async () => {
    const onCapture = jest.fn();
    const user = userEvent.setup();
    await render(
      <TimelineHeader
        childName="Mabel"
        view="list"
        onSelectView={jest.fn()}
        onCapture={onCapture}
      />,
    );
    await user.press(screen.getByLabelText('Capture a moment'));
    expect(onCapture).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- TimelineHeader
```

Expected: FAIL, `Cannot find module '../TimelineHeader'`.

- [ ] **Step 3: Implement `src/features/moments/TimelineHeader.tsx`**

```tsx
import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, font, space, type } from '@/theme/tokens';
import type { TimelineView } from './timelineView';

type Props = {
  childName: string;
  view: TimelineView;
  onSelectView: (next: TimelineView) => void;
  onCapture: () => void;
};

export function TimelineHeader({ childName, view, onSelectView, onCapture }: Props) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>TheyJust</Text>
        <Text style={styles.childLine}>{`${childName}'s story`}</Text>
      </View>
      <View style={styles.actions}>
        {/* Selection is an underline, not a chip: DESIGN.md rules out pills. */}
        <Pressable
          onPress={() => onSelectView('list')}
          accessibilityRole="button"
          accessibilityLabel="List view"
          style={[styles.toggle, view === 'list' && styles.toggleActive]}
        >
          <Feather name="list" size={18} color={view === 'list' ? color.damson : color.inkMuted} />
        </Pressable>
        <Pressable
          onPress={() => onSelectView('spine')}
          accessibilityRole="button"
          accessibilityLabel="Timeline view"
          style={[styles.toggle, view === 'spine' && styles.toggleActive]}
        >
          {/* git-commit is a line with a node on it — the view it selects. */}
          <Feather
            name="git-commit"
            size={18}
            color={view === 'spine' ? color.damson : color.inkMuted}
          />
        </Pressable>
        <Pressable
          onPress={onCapture}
          accessibilityRole="button"
          accessibilityLabel="Capture a moment"
          style={styles.add}
        >
          {/* A vector glyph centres in its own box; a text "+" sits on the
              maths axis and always reads high inside a circle. */}
          <Feather name="plus" size={22} color={color.onDamson} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.md,
    backgroundColor: color.paper,
  },
  brand: { fontFamily: font.displayBold, fontSize: type.display, color: color.ink, letterSpacing: -0.5 },
  childLine: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  toggle: {
    paddingHorizontal: space.xs,
    paddingBottom: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  toggleActive: { borderBottomColor: color.damson },
  add: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.damson,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.sm,
  },
});
```

- [ ] **Step 4: Wire it into the screen.** In `src/app/(app)/(tabs)/index.tsx`, replace the import block:

```tsx
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useSession } from '@/features/auth/useSession';
import { useSelectedChild } from '@/features/children/selectedChild';
import { MomentCard } from '@/features/moments/MomentCard';
import { useTimeline, type Moment } from '@/features/moments/momentQueries';
import { signedPhotoUrl } from '@/features/moments/photoUpload';
import { color, font, space, type } from '@/theme/tokens';
```

with:

```tsx
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useSession } from '@/features/auth/useSession';
import { useSelectedChild } from '@/features/children/selectedChild';
import { MomentCard } from '@/features/moments/MomentCard';
import { useTimeline, type Moment } from '@/features/moments/momentQueries';
import { signedPhotoUrl } from '@/features/moments/photoUpload';
import { SpineTimeline } from '@/features/moments/SpineTimeline';
import { TimelineHeader } from '@/features/moments/TimelineHeader';
import { useTimelineView } from '@/features/moments/timelineView';
import { color, font, space, type } from '@/theme/tokens';
```

- [ ] **Step 5: Read the stored view.** Add below `const photoUrls = useFirstPhotoUrls(moments);`:

```tsx
  const { view, setView } = useTimelineView();
```

- [ ] **Step 6: Replace the returned FlatList.** Replace everything from `return (` down to the closing `);` of the component (the whole `<FlatList …/>` block) with:

```tsx
  const header = (
    <TimelineHeader
      childName={selected.name}
      view={view}
      onSelectView={setView}
      onCapture={() => router.push('/capture')}
    />
  );

  if (view === 'spine' && moments.length > 0) {
    return (
      <View style={styles.screen}>
        {header}
        <SpineTimeline
          dateOfBirth={selected.date_of_birth}
          dueDate={selected.due_date}
          moments={moments}
          photoUrls={photoUrls}
          onOpenMoment={(id) => router.push(`/moment/${id}`)}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <FlatList
        style={styles.list}
        data={moments}
        keyExtractor={(m) => m.id}
        ListEmptyComponent={
          <View style={styles.feedEmpty}>
            <Text style={styles.feedEmptyTitle}>No moments yet</Text>
            <Text style={styles.feedEmptyBody}>Tap + to capture their first, or start from Milestones.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/moment/${item.id}`)}>
            <MomentCard
              moment={item}
              childDateOfBirth={selected.date_of_birth}
              loggedByYou={item.logged_by === session?.user.id}
              photoUrl={photoUrls[item.id] ?? null}
            />
          </Pressable>
        )}
      />
    </View>
  );
```

An empty timeline always falls through to the list, so the existing "No moments yet" state is the one a new parent meets — a spine of one anchor and nothing else would say less than that does.

- [ ] **Step 7: Update the styles.** In the `StyleSheet.create` block, add a `screen` key and delete the four keys the header took with it (`header`, `brand`, `childLine`, `add`). The block becomes:

```tsx
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  list: { backgroundColor: color.paper },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xl, gap: space.md, backgroundColor: color.paper },
  emptyTitle: { fontFamily: font.display, fontSize: 30, color: color.ink, textAlign: 'center', letterSpacing: -0.3 },
  emptyBody: { fontFamily: font.body, fontSize: type.body, color: color.inkMuted, textAlign: 'center', marginBottom: space.sm },
  emptyButton: { alignSelf: 'stretch', paddingHorizontal: space.xl },
  feedEmpty: { padding: space.xl, alignItems: 'center', gap: space.sm },
  feedEmptyTitle: { fontFamily: font.display, fontSize: type.title, color: color.ink },
  feedEmptyBody: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted, textAlign: 'center' },
});
```

- [ ] **Step 8: Verify**

```bash
npm test -- TimelineHeader
rm -f .expo/types/router.d.ts && npx tsc --noEmit && npm test
```

Expected: TimelineHeader 4 passed; tsc exit 0 (it will fail if any deleted style key is still referenced); full suite green.

- [ ] **Step 9: Commit**

```bash
git add src/features/moments/TimelineHeader.tsx src/features/moments/__tests__/TimelineHeader.test.tsx "src/app/(app)/(tabs)/index.tsx"
git commit -m "feat: a view toggle in the timeline header, and the spine behind it"
```

---

### Task 8: Full gates and runtime verification

**Files:** none new.

- [ ] **Step 1: Full local gates**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test && npx supabase test db
```

Expected: tsc exit 0; Jest green (161 existing + 47 new); pgTAP 52 assertions pass.

- [ ] **Step 2: Web export smoke check**

```bash
npx expo export --platform web > /dev/null 2>&1 && echo "export OK" && rm -rf dist
```

Expected: `export OK`.

- [ ] **Step 3: Verify against real data in the browser.** The development database holds Mabel: born 22/05/2025, with eight moments between 08/07/2026 and 18/07/2026. That shape exercises both halves of the feature — one enormous first gap and one tight cluster — so it is the right thing to look at.

Confirm:

1. The toggle appears between the child line and the `+`, the active glyph is damson and underlined, the inactive is muted grey.
2. Switching to the spine shows **Born** at the top, then the moments oldest-first.
3. The gap from birth to the first moment is captioned **"14 months"** — 412 days.
4. Age rules appear down that gap, labelled "1 month old" through "12 months old", none of them crowding a row.
5. The July moments cluster tightly: the 08→14 July gap is 54px and 14→18 July is 44px, visibly tighter than anything above them.
6. Tapping a row opens that moment's detail; tapping **Born** does nothing.
7. Reload the page: the spine is still selected.
8. Switch back to the list and reload: the list is still selected.

Check the console for errors after switching views in both directions — a `getItemLayout` mismatch shows up as a scroll jump rather than a thrown error, so scroll the full spine rather than only reading the top.

---

## Self-review

**Spec coverage.** §3 the scale — Task 1. §4 row anatomy including the Born anchor — Tasks 2 and 4. §5 rules, corrected-age origin, gap captions, and the deliberate `formatGap` divergence — Tasks 1 and 3. §6 the toggle, underline selection, and list-as-default persistence — Tasks 6 and 7. §7 row-height-is-the-following-gap and `getItemLayout` — Tasks 2 and 5. §9 edge cases: one moment and no moments (Task 7 Step 6 falls through to the list; Task 2 covers the single-row case), pre-birth clamp (Task 2), several moments on one date (the 44px floor, Task 1), a long first gap (Task 8 Step 3, which is exactly the real data). §10 testing — every task is test-first, and Step 3 of Task 8 is the runtime pass.

**Deliberate gaps.** No test asserts the *visual* placement of a rule inside its trailing space; the offsets are unit-tested arithmetic in Task 3, and whether they look right is Task 8's job — RNTL cannot see layout. No jump-to-date control, per spec §11.

**Two corrections made while reviewing this plan, both caught by computing the numbers rather than trusting them.** First, clearance from the top of a gap was 16px, but a row's head is 44px of type — every rule falling in the first 60px would have drawn straight across a title. It is now `ROW_HEAD + CLEARANCE`, and `ROW_HEAD` is exported so the component and the layout cannot drift apart. Second, a centred caption collides with rules: over a 123-day gap the caption sits at 122px and the 2-month rule at 121px. The clearance check already resolves it in the caption's favour, but the original "rules at each month" test asserted a rule that its own implementation would have dropped. That test now uses a span with no collision, and the collision has a test of its own.

**One behaviour change to call out at demo:** the header stops scrolling away in the list view. It is a consequence of hoisting the header above both views, which the toggle and `getItemLayout` both need. If it turns out to be unwelcome, the fix is to pass `header` back into each list's `ListHeaderComponent` and drop `getItemLayout` — the spine still virtualises without it.

**Type consistency.** `gapPx`, `formatGap`, `layoutSpine`, `SpineRow` (type), `SpineMark`, `SpineInput` are defined in Tasks 1–3 and consumed in 4–5. The component `SpineRow` and the type `SpineRow` share a name, so every consumer imports the type as `type SpineRow as Row` — as written in both `SpineRow.tsx` and `SpineTimeline.tsx`. `useTimelineView()` returns `{view, setView}` (Task 6) and is destructured that way in Task 7. `TimelineHeader` takes `childName`/`view`/`onSelectView`/`onCapture`; `SpineTimeline` takes `dateOfBirth`/`dueDate`/`moments`/`photoUrls`/`onOpenMoment`. `selected.due_date` is the `Child` field name from `src/features/children/queries.ts`. `formatShortDate` is added in Task 4 and used in `SpineRow.tsx`.
