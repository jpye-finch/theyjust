// Vertical distance on the spine IS elapsed time. A square-root curve is what
// makes that survive five years: gaps keep growing, but ever more slowly, so a
// quiet year does not become thousands of pixels of empty scroll.

const MIN_GAP = 44;
const K = 22;

/** Pixels of spine for a gap of `days`. Floored at one row height. */
export function gapPx(days: number): number {
  return Math.max(MIN_GAP, Math.sqrt(Math.max(0, days)) * K);
}

import type { Moment } from './momentQueries';
import { momentTitle } from './momentText';
import { formatAgeParts } from '../children/age';
import { formatDayMonth } from '../../lib/date';

const MS_PER_DAY = 86_400_000;

export type SpineMark = { label: string; offset: number };

export type SpineRow = {
  key: string;
  kind: 'born' | 'moment';
  momentId: string | null;
  date: string;
  title: string;
  /** "18 Jul", or null when this row repeats the date of the row above it —
   *  a cluster then reads as one day carrying several moments, rather than the
   *  same date stamped four times down the column. */
  dateLabel: string | null;
  /** "2026", shown only on the first row of a year. Repeating it on every row
   *  buys nothing: the spine is in date order and the rules give the scale. */
  yearLabel: string | null;
  /** This row's own height: the gap that FOLLOWS it. */
  height: number;
  /** Absolute distance from the top, so getItemLayout stays O(1). */
  offset: number;
  rules: SpineMark[];
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

// `newer` is the row above, `older` the row below: the spine runs newest-first,
// so scrolling down goes back in time and a rule's distance from the top of the
// gap is how far BACK it sits from the row above it.
function rulesInGap(
  origin: string,
  newer: string,
  older: string,
  gapDays: number,
  height: number,
): SpineMark[] {
  if (gapDays <= 0) return [];
  return ruleDates(origin)
    .filter((mark) => mark.date > older && mark.date <= newer)
    .map((mark) => ({ label: mark.label, offset: (daysBetween(mark.date, newer) / gapDays) * height }))
    .filter(
      (mark) =>
        // Clear of the head above (which is 44px of type, not a hairline) and of
        // the row below. The caption needs no clearance: it sits left of the
        // spine and the rules sit right of it, so they cannot collide however
        // close their heights. Suppressing on height alone punched holes in an
        // otherwise regular month sequence — "6, [nothing], 8" reads as a bug.
        mark.offset >= ROW_HEAD + CLEARANCE && height - mark.offset >= CLEARANCE,
    );
}

export function layoutSpine({ dateOfBirth, dueDate, moments }: SpineInput): SpineRow[] {
  // Newest first, matching the list view: you open the app to see what just
  // happened, and on a five-year spine an oldest-first order would land you at
  // birth with thousands of pixels between you and today. Scrolling down goes
  // back through time, so Born anchors the BOTTOM — the beginning you scroll
  // back to rather than the thing you always start on.
  const ordered = [...moments].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));

  const entries = [
    ...ordered.map((m) => ({
      key: m.id,
      kind: 'moment' as const,
      momentId: m.id,
      date: m.occurred_on,
      title: momentTitle(m),
    })),
    { key: 'born', kind: 'born' as const, momentId: null, date: dateOfBirth, title: 'Born' },
  ];

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
    // `next` is the row BELOW, which is older. Negative means a moment dated
    // before the child was born — clamp rather than draw upward through the row
    // above it.
    const gapDays = next ? Math.max(0, daysBetween(next.date, entry.date)) : 0;
    const height = next ? gapPx(gapDays) : MIN_GAP;

    const rules = next ? rulesInGap(rulerOrigin, entry.date, next.date, gapDays, height) : [];

    const previous = entries[i - 1];
    const repeatsDate = previous !== undefined && previous.date === entry.date;
    const startsNewYear = previous === undefined || previous.date.slice(0, 4) !== entry.date.slice(0, 4);

    rows.push({
      ...entry,
      dateLabel: repeatsDate ? null : formatDayMonth(entry.date),
      yearLabel: !repeatsDate && startsNewYear ? entry.date.slice(0, 4) : null,
      height,
      offset,
      rules,
    });
    offset += height;
  }
  return rows;
}
