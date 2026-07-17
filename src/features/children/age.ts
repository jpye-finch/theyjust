// Pure date-only age math. DB dates arrive as ISO strings (YYYY-MM-DD) and are
// read as-is; Date instants (a caller's "now") are read as the caller's LOCAL
// calendar date — the user's wall clock decides what "today" is, and a device
// timezone can never shift a stored birthday. Corrected age (premature babies)
// counts from the due date and applies until 24 months corrected (spec §5).

export type AgeParts = { months: number; weeks: number };

export type ChildAge = {
  chronological: AgeParts;
  corrected: AgeParts | null;
  /** Age in (possibly fractional) months to compare against catalogue ranges. */
  comparisonMonths: number;
};

const CORRECTED_AGE_CUTOFF_MONTHS = 24;
const AVERAGE_DAYS_PER_MONTH = 30.4375;
const MS_PER_DAY = 86_400_000;

function toUtcDate(d: string | Date): Date {
  if (d instanceof Date) {
    // A Date instant means "now": read its LOCAL calendar date.
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return new Date(`${d}T00:00:00Z`);
}

/** from + months, clamping to the last day of the target month (Jan 31 + 1mo = Feb 28/29). */
function addMonthsClamped(from: Date, months: number): Date {
  const targetMonthStart = Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1);
  const t = new Date(targetMonthStart);
  const daysInTarget = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(from.getUTCDate(), daysInTarget)));
}

function wholeMonthsBetween(from: Date, to: Date): number {
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (addMonthsClamped(from, months) > to) months -= 1;
  return Math.max(0, months);
}

export function ageParts(from: string | Date, on: string | Date): AgeParts {
  const f = toUtcDate(from);
  const o = toUtcDate(on);
  const months = wholeMonthsBetween(f, o);
  const anchor = addMonthsClamped(f, months);
  const days = Math.max(0, Math.round((o.getTime() - anchor.getTime()) / MS_PER_DAY));
  return { months, weeks: Math.floor(days / 7) };
}

export function ageInMonths(from: string | Date, on: string | Date): number {
  const f = toUtcDate(from);
  const o = toUtcDate(on);
  const months = wholeMonthsBetween(f, o);
  const anchor = addMonthsClamped(f, months);
  const days = Math.max(0, Math.round((o.getTime() - anchor.getTime()) / MS_PER_DAY));
  return months + days / AVERAGE_DAYS_PER_MONTH;
}

export function childAge(
  dateOfBirth: string | Date,
  dueDate: string | Date | null,
  on: string | Date,
): ChildAge {
  const chronological = ageParts(dateOfBirth, on);
  if (dueDate != null) {
    const correctedMonths = ageInMonths(dueDate, on);
    if (correctedMonths < CORRECTED_AGE_CUTOFF_MONTHS) {
      return {
        chronological,
        corrected: ageParts(dueDate, on),
        comparisonMonths: correctedMonths,
      };
    }
  }
  return { chronological, corrected: null, comparisonMonths: ageInMonths(dateOfBirth, on) };
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

export function formatAgeParts(p: AgeParts): string {
  if (p.months >= 24) {
    const years = Math.floor(p.months / 12);
    const rem = p.months % 12;
    return rem === 0 ? plural(years, 'year') : `${plural(years, 'year')}, ${plural(rem, 'month')}`;
  }
  if (p.months === 0) {
    return p.weeks === 0 ? 'less than a week' : plural(p.weeks, 'week');
  }
  return p.weeks === 0 ? plural(p.months, 'month') : `${plural(p.months, 'month')}, ${plural(p.weeks, 'week')}`;
}

export function formatChildAge(a: ChildAge): string {
  const chron = formatAgeParts(a.chronological);
  return a.corrected ? `${chron} — ${formatAgeParts(a.corrected)} corrected` : chron;
}
