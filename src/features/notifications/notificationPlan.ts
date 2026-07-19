import { addMonths } from '@/lib/date';
import { formatAgeParts } from '../children/age';
import type { Child } from '../children/queries';
import type { Moment } from '../moments/momentQueries';
import { AGE_BODY, ageTitle, lookBackBody, lookBackTitle } from './notificationCopy';

const MS_PER_DAY = 86_400_000;
const LOOK_BACK_MONTHS = [2, 3, 6, 12, 18, 24];
const AGE_MONTHS_THROUGH = 24;
const OLDEST_AGE_YEAR = 18;
const DEFAULT_WEEKS = 8;

/** After a bedtime that has probably just happened. */
export const FIRE_HOUR = 19;
export const FIRE_MINUTE = 30;

export type NotificationCadence = 'weekly' | 'monthly' | 'off';

export type PlannedNotification = {
  /** Stable and unique, so a rebuild produces the same plan. */
  key: string;
  fireOn: string;
  fireAtHour: number;
  fireAtMinute: number;
  title: string;
  body: string;
  childId: string;
  momentId: string | null;
};

export type NotificationPlanInput = {
  today: string;
  children: Child[];
  momentsByChild: Record<string, Moment[]>;
  cadence: NotificationCadence;
  /** Rolling window. iOS caps pending local notifications at 64. */
  weeks?: number;
};

type Candidate = PlannedNotification & {
  isAge: boolean;
  hasPhoto: boolean;
  months: number;
};

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / MS_PER_DAY,
  );
}

function addDays(iso: string, n: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

// Monthly through two years, then birthdays: the same cadence the spine rules
// itself by, because the app should measure time one way.
function ageCandidates(childRecord: Child, today: string, horizon: string): Candidate[] {
  // Corrected age when a due date is present, matching the rest of the app.
  const origin = childRecord.due_date ?? childRecord.date_of_birth;
  const out: Candidate[] = [];

  const push = (months: number) => {
    const fireOn = addMonths(origin, months);
    if (fireOn <= today || fireOn > horizon) return;
    out.push({
      key: `age-${childRecord.id}-${fireOn}`,
      fireOn,
      fireAtHour: FIRE_HOUR,
      fireAtMinute: FIRE_MINUTE,
      title: ageTitle(childRecord.name, formatAgeParts({ months, weeks: 0 })),
      body: AGE_BODY,
      childId: childRecord.id,
      momentId: null,
      isAge: true,
      hasPhoto: false,
      months,
    });
  };

  for (let n = 1; n <= AGE_MONTHS_THROUGH; n++) push(n);
  for (let year = 3; year <= OLDEST_AGE_YEAR; year++) push(year * 12);
  return out;
}

function lookBackCandidates(
  childRecord: Child,
  moments: Moment[],
  today: string,
  horizon: string,
): Candidate[] {
  const out: Candidate[] = [];
  for (const moment of moments) {
    for (const months of LOOK_BACK_MONTHS) {
      const fireOn = addMonths(moment.occurred_on, months);
      if (fireOn <= today || fireOn > horizon) continue;
      out.push({
        key: `look-${moment.id}-${months}`,
        fireOn,
        fireAtHour: FIRE_HOUR,
        fireAtMinute: FIRE_MINUTE,
        title: lookBackTitle(months),
        body: lookBackBody(childRecord.name, moment),
        childId: childRecord.id,
        momentId: moment.id,
        isAge: false,
        hasPhoto: moment.moment_photos.length > 0,
        months,
      });
    }
  }
  return out;
}

export function planNotifications({
  today,
  children,
  momentsByChild,
  cadence,
  weeks = DEFAULT_WEEKS,
}: NotificationPlanInput): PlannedNotification[] {
  if (cadence === 'off' || children.length === 0) return [];

  const horizon = addDays(today, weeks * 7);

  const candidates: Candidate[] = [];
  for (const childRecord of children) {
    candidates.push(...ageCandidates(childRecord, today, horizon));
    candidates.push(
      ...lookBackCandidates(childRecord, momentsByChild[childRecord.id] ?? [], today, horizon),
    );
  }

  // Weeks counted from today rather than by calendar, so the grouping has no
  // year-boundary or locale edge cases to get wrong.
  const groupOf = (candidate: Candidate) =>
    cadence === 'weekly'
      ? String(Math.floor(daysBetween(today, candidate.fireOn) / 7))
      : candidate.fireOn.slice(0, 7);

  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const group = groupOf(candidate);
    const existing = groups.get(group);
    if (existing) existing.push(candidate);
    else groups.set(group, [candidate]);
  }

  // Rotation is counted as the plan is built, not persisted: the plan is
  // rebuilt from scratch every time, so a stored cursor would only be a way for
  // it to drift out of step with itself.
  const perChild = new Map<string, number>();
  const chosen: PlannedNotification[] = [];

  for (const group of [...groups.keys()].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))) {
    const best = [...(groups.get(group) ?? [])].sort((a, b) => {
      // An age moment happens once and cannot be deferred to another week.
      if (a.isAge !== b.isAge) return a.isAge ? -1 : 1;
      // Something to look at beats something to only read.
      if (a.hasPhoto !== b.hasPhoto) return a.hasPhoto ? -1 : 1;
      // Six months back lands harder than two.
      if (a.months !== b.months) return b.months - a.months;
      // Then whichever child has had the fewest so far, so a second or third
      // child is not perpetually crowded out.
      const seen = (perChild.get(a.childId) ?? 0) - (perChild.get(b.childId) ?? 0);
      if (seen !== 0) return seen;
      return a.key.localeCompare(b.key);
    })[0];

    if (!best) continue;
    perChild.set(best.childId, (perChild.get(best.childId) ?? 0) + 1);
    const { isAge: _isAge, hasPhoto: _hasPhoto, months: _months, ...notification } = best;
    chosen.push(notification);
  }

  return chosen.sort((a, b) => a.fireOn.localeCompare(b.fireOn));
}
