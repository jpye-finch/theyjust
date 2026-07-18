import { toIsoDate } from '../../lib/date';

// Local calendar date as YYYY-MM-DD (matches the age module's local-day rule).
// `now` is injectable so the format and the local-day behaviour are unit-testable.
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}
