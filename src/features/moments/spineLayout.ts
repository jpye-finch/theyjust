// Vertical distance on the spine IS elapsed time. A square-root curve is what
// makes that survive five years: gaps keep growing, but ever more slowly, so a
// quiet year does not become thousands of pixels of empty scroll.

import { formatAgeParts } from '../children/age';
import { formatDayMonth } from '../../lib/date';
import type { Moment } from './momentQueries';
import { momentTitle } from './momentText';

const MIN_GAP = 44;
const K = 22;
const MS_PER_DAY = 86_400_000;
const MONTHLY_RULES_THROUGH = 24;
const OLDEST_RULED_YEAR = 18;

/** Height of a moment's head — the date, dot, title and thumbnail. */
export const ROW_HEAD = 44;

/** Pixels of spine for a gap of `days`. Floored at one row height. */
export function gapPx(days: number): number {
  return Math.max(MIN_GAP, Math.sqrt(Math.max(0, days)) * K);
}

export type SpineRow = {
  key: string;
  /** `rule` is an age divider — "3 months old" — and carries no moment. */
  kind: 'born' | 'moment' | 'rule';
  momentId: string | null;
  date: string;
  title: string;
  /** "18 Jul", or null on a divider and on a row repeating the date above it —
   *  a cluster then reads as one day carrying several moments, rather than the
   *  same date stamped four times down the column. */
  dateLabel: string | null;
  /** "2026", shown only on the first dated row of a year. */
  yearLabel: string | null;
  /** This row's own height: the distance down to the row BELOW it. */
  height: number;
  /** Absolute distance from the top, so getItemLayout stays O(1). */
  offset: number;
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

type Mark = Pick<SpineRow, 'key' | 'kind' | 'momentId' | 'date' | 'title'>;

export function layoutSpine({ dateOfBirth, dueDate, moments }: SpineInput): SpineRow[] {
  // Newest first, matching the list view: you open the app to see what just
  // happened, and on a five-year spine an oldest-first order would land you at
  // birth with thousands of pixels between you and today. Scrolling down goes
  // back through time, so Born anchors the BOTTOM.
  const ordered = [...moments].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  const newest = ordered.length > 0 ? ordered[0].occurred_on : dateOfBirth;

  // The ruler follows corrected age when there is a due date: for a premature
  // baby "1 month old" belongs a month after the date they were due. One origin
  // throughout — a ruler that changed its own origin mid-scroll would be worse
  // than one that is consistently corrected.
  const rulerOrigin = dueDate ?? dateOfBirth;

  const marks: Mark[] = ordered.map((m) => ({
    key: m.id,
    kind: 'moment' as const,
    momentId: m.id,
    date: m.occurred_on,
    title: momentTitle(m),
  }));

  // Every age divider in range, whether or not anything was logged around it.
  // These used to be decorations positioned inside the gap between two moments,
  // which meant they vanished wherever moments were dense — breaking the cadence
  // exactly where the most was happening. They are rows now: always present,
  // always legible, and the steady beat of them IS the sense of time passing.
  for (const rule of ruleDates(rulerOrigin)) {
    if (rule.date > dateOfBirth && rule.date <= newest) {
      marks.push({
        key: `rule-${rule.date}`,
        kind: 'rule' as const,
        momentId: null,
        date: rule.date,
        title: rule.label,
      });
    }
  }

  // Newest first. On a tie the moment sits above its divider, so a moment logged
  // on a birthday reads as happening on the day rather than after it.
  marks.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (a.kind === 'rule' ? 1 : 0) - (b.kind === 'rule' ? 1 : 0);
  });

  marks.push({
    key: 'born',
    kind: 'born' as const,
    momentId: null,
    date: dateOfBirth,
    title: 'Born',
  });

  const rows: SpineRow[] = [];
  let offset = 0;
  // The date column is only redrawn when it changes, and dividers carry no date
  // of their own, so the comparison has to skip them.
  let lastDatedRow: string | null = null;

  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    const next = marks[i + 1];
    // Negative means a moment dated before the child was born — clamp rather
    // than draw upward through the row above it.
    const gapDays = next ? Math.max(0, daysBetween(next.date, mark.date)) : 0;
    const height = next ? gapPx(gapDays) : ROW_HEAD;

    const isDated = mark.kind !== 'rule';
    const repeatsDate = isDated && lastDatedRow === mark.date;
    const startsNewYear =
      isDated && (lastDatedRow === null || lastDatedRow.slice(0, 4) !== mark.date.slice(0, 4));

    rows.push({
      ...mark,
      dateLabel: isDated && !repeatsDate ? formatDayMonth(mark.date) : null,
      yearLabel: isDated && !repeatsDate && startsNewYear ? mark.date.slice(0, 4) : null,
      height,
      offset,
    });

    if (isDated) lastDatedRow = mark.date;
    offset += height;
  }
  return rows;
}
