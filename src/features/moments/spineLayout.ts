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
