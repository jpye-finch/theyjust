// True iff `iso` is a real YYYY-MM-DD calendar date. A UTC round-trip rejects
// out-of-range days (2026-02-30), non-leap Feb 29, and bad months, so every form
// validates dates identically. Shared by ChildForm and CaptureForm.
export function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

// A Date's LOCAL calendar day as YYYY-MM-DD. Local (not toISOString) so a date
// picked late in the evening never jumps a day in a negative-UTC zone.
export function toIsoDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// How a stored date is shown to a parent: "18 July 2026", never a raw ISO
// string. Read straight off the string instead of via Date, so no device or
// test timezone can shift the day. Anything that is not a real date is passed
// through unchanged rather than rendered as "NaN Undefined NaN".
export function formatDisplayDate(iso: string): string {
  if (!isRealDate(iso)) return iso;
  const [year, month, day] = iso.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

// dd/mm/yyyy for the spine's date column, where a narrow fixed-width date keeps
// the column aligned. Parsed by string rather than Date, so a timezone can never
// shift the day.
export function formatShortDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
