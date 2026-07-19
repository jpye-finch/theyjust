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
