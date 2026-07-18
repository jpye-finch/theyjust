// Local calendar date as YYYY-MM-DD (matches the age module's local-day rule).
// `now` is injectable so the format and the local-day behaviour are unit-testable.
export function todayIso(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${day}`;
}
