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

import type { Moment } from './momentQueries';
import { momentTitle } from './momentText';
import { formatAgeParts } from '../children/age';

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
}
