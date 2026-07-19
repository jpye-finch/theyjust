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

// "18 Jul" for the spine's date column. The year is deliberately absent: the
// spine carries it separately, and only on the row where it changes. Same
// string-parsing contract as formatDisplayDate — no Date, no timezone.
export function formatDayMonth(iso: string): string {
  if (!isRealDate(iso)) return iso;
  const [, month, day] = iso.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1].slice(0, 3)}`;
}

// Shared because three modules need the same calendar month step: the spine's
// age rules, the notification plan, and any future ruler. Clamps to the last day
// of the target month, so 31 Jan + 1 month is 28 (or 29) Feb rather than 3 March.
export function addMonths(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
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
