# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A weekly local notification that brings a parent back to the app — either a look-back at a moment from two months ago, or a note that their child is a month older today.

**Architecture:** Everything that decides *what* gets sent lives in one pure module, `notificationPlan.ts`, which takes children, moments, today and a cadence and returns the notifications to schedule. Nothing native, nothing async, so the whole behaviour — intervals, caps, priority, rotation and the copy itself — is provable in Jest. A thin shell over `expo-notifications` cancels and reschedules from that plan. Local only: no push server, no APNs, and therefore nothing blocked behind the Apple Developer account except iOS device testing.

**Tech Stack:** Expo SDK 57, expo-notifications, AsyncStorage, jest-expo + RNTL v14.

---

## Spec

`docs/superpowers/specs/2026-07-19-theyjust-notifications-design.md` (approved 2026-07-19). **Read it before starting** — particularly §3, which is the rule the whole design hangs on and which Task 2 turns into tests.

## Decisions taken since the spec

The spec closed with four open questions. All four are answered here. Each is cheap to change later — they are constants and a copy table, not architecture.

| Question | Decision | Why |
|---|---|---|
| Cadence | **Weekly** default; Weekly / Monthly / Off in settings. **Never a Daily option.** | Weekly suits a memory book. Offering Daily would offer the setting that damages the product. |
| Delivery time | **19:30 local**, no setting in v1 | After a bedtime that has probably just happened. A setting can come later if anyone asks. |
| Look-back intervals | **2, 3, 6, 12, 18, 24 months.** One month is dropped. | A month is not enough elapsed time to feel like a memory. Two months is where it starts to land. |
| In-app look-back surface | **Out of v1** | Notifications only. The surface was the original framing before the app's two-to-three-year window made the notification its better home. |

## Context an implementer needs

- `npm test` pins `TZ=America/Los_Angeles`; a bare `npx jest` uses the host zone. Always use `npm test`.
- Local `tsc` needs `rm -f .expo/types/router.d.ts` first. `tsconfig.json` excludes `supabase/functions`.
- **Never run `npm run lint`** — the project has no eslint config, and Expo's lint command scaffolds one and installs dependencies, contaminating the tree.
- RNTL v14: `render`, `renderHook`, `rerender` and `act` are **all async — await every one**. An unawaited `act` leaks a broken act environment into the *next* test in the file, so the failure surfaces away from its cause.
- If npm reports Node v14, re-run that command through `zsh -lc '…'`.
- Imports: `@/` for `@/components`, `@/features`, `@/lib`, `@/theme` even inside `src/features`; relative for same-feature modules.
- Dates are ISO `YYYY-MM-DD`, parsed as UTC calendar days. A device timezone must never shift a stored date.
- Install Expo packages with `npx expo install`, never bare `npm install` — it picks the version matched to SDK 57.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/date.ts` | gains the shared `addMonths` (moved out of spineLayout) |
| `src/features/notifications/notificationCopy.ts` | pure: every string a parent can receive |
| `src/features/notifications/notificationPlan.ts` | pure: who gets notified, when, and about what |
| `src/features/notifications/notificationSettings.ts` | the persisted cadence |
| `src/features/notifications/permission.ts` | when to ask, and the record that we did |
| `src/features/notifications/scheduler.ts` | thin shell over expo-notifications |
| `src/app/(app)/(tabs)/family.tsx` | the Reminders settings section |
| `app.json` | the expo-notifications plugin, icon and accent colour |

---

### Task 1: Share the month arithmetic before a third copy exists (TDD)

`addMonths(iso, n)` is currently private inside `spineLayout.ts`. `age.ts` has its own `addMonthsClamped` on `Date` objects. Notifications need the same calculation, and a third copy is the point at which they start to drift apart.

Move the ISO-string one to `src/lib/date.ts`. **Leave `age.ts` alone** — different signature, battle-tested, and no reason to touch it.

**Files:**
- Modify: `src/lib/date.ts`
- Modify: `src/lib/__tests__/date.test.ts`
- Modify: `src/features/moments/spineLayout.ts`

- [ ] **Step 1: Write the failing tests.** Append to `src/lib/__tests__/date.test.ts`, adding `addMonths` to the existing import from `../date`:

```ts
describe('addMonths', () => {
  it('advances by whole months', () => {
    expect(addMonths('2026-01-15', 1)).toBe('2026-02-15');
    expect(addMonths('2026-01-15', 7)).toBe('2026-08-15');
    expect(addMonths('2026-01-15', 24)).toBe('2028-01-15');
  });

  it('clamps to the last day of a shorter month', () => {
    // 31 Jan + 1 month has no 31 Feb to land on.
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('knows about leap years', () => {
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2028-02-29', 12)).toBe('2029-02-28');
  });

  it('goes backwards too', () => {
    expect(addMonths('2026-03-15', -1)).toBe('2026-02-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- date
```

Expected: FAIL — `addMonths is not a function`.

- [ ] **Step 3: Implement it in `src/lib/date.ts`.** Append:

```ts
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
```

- [ ] **Step 4: Use it from the spine.** In `src/features/moments/spineLayout.ts`, delete the private `addMonths` function entirely (the whole block including its `/** from + n months… */` comment) and change the import line:

```ts
import { formatDayMonth } from '../../lib/date';
```

to:

```ts
import { addMonths, formatDayMonth } from '../../lib/date';
```

- [ ] **Step 5: Run to verify everything still passes**

```bash
npm test -- date spineLayout && rm -f .expo/types/router.d.ts && npx tsc --noEmit
```

Expected: date tests pass with 4 new; all spineLayout tests still pass unchanged; tsc exit 0. The spine's behaviour must not move — this is a pure extraction.

- [ ] **Step 6: Commit**

```bash
git add src/lib/date.ts src/lib/__tests__/date.test.ts src/features/moments/spineLayout.ts
git commit -m "refactor: share addMonths before a third copy of it exists"
```

---

### Task 2: The words (TDD)

Every string a parent can receive, in one pure module, so the spec's §3 rule stops being a good intention and becomes a test.

**Files:**
- Create: `src/features/notifications/notificationCopy.ts`
- Test: `src/features/notifications/__tests__/notificationCopy.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/notifications/__tests__/notificationCopy.test.ts`:

```ts
import type { Moment } from '../../moments/momentQueries';
import { AGE_BODY, ageTitle, lookBackBody, lookBackTitle } from '../notificationCopy';

const moment = (overrides: Partial<Moment> = {}): Moment => ({
  id: 'm1',
  child_id: 'c1',
  milestone_id: null,
  custom_title: 'First swim',
  occurred_on: '2026-05-10',
  note: null,
  logged_by: 'u1',
  created_at: '2026-05-10T00:00:00.000Z',
  moment_photos: [],
  ...overrides,
});

describe('lookBackTitle', () => {
  it('counts in words, because there are only six of them', () => {
    expect(lookBackTitle(2)).toBe('Two months ago today');
    expect(lookBackTitle(3)).toBe('Three months ago today');
    expect(lookBackTitle(6)).toBe('Six months ago today');
    expect(lookBackTitle(12)).toBe('A year ago today');
    expect(lookBackTitle(18)).toBe('A year and a half ago today');
    expect(lookBackTitle(24)).toBe('Two years ago today');
  });
});

describe('lookBackBody', () => {
  it('names the child rather than saying "they"', () => {
    // momentTitle() would give "They just rolled over!", and "they" is ambiguous
    // the moment a family has two children.
    const rolled = moment({ milestone_id: 'rolled_over', custom_title: null });
    expect(lookBackBody('Wren', rolled)).toBe('Wren rolled over.');
  });

  it('uses a custom moment’s own words, untouched', () => {
    expect(lookBackBody('Wren', moment())).toBe('First swim');
  });

  it('falls back to the custom title if a milestone id is unknown', () => {
    // A catalogue entry could be renamed or removed; a notification must still
    // say something rather than crash or read "Wren undefined.".
    const orphan = moment({ milestone_id: 'not_in_catalogue', custom_title: 'Something' });
    expect(lookBackBody('Wren', orphan)).toBe('Something');
  });
});

describe('ageTitle', () => {
  it('states the age plainly', () => {
    expect(ageTitle('Wren', '7 months')).toBe('Wren is 7 months old today');
    expect(ageTitle('Wren', '2 years')).toBe('Wren is 2 years old today');
  });
});

describe('the copy rules from spec §3', () => {
  // The rule is that a notification is about the child, never about the parent.
  // These assertions are the rule, executable.
  const everyString = [
    AGE_BODY,
    ageTitle('Wren', '7 months'),
    lookBackBody('Wren', moment()),
    lookBackBody('Wren', moment({ milestone_id: 'rolled_over', custom_title: null })),
    ...[2, 3, 6, 12, 18, 24].map(lookBackTitle),
  ];

  it('never addresses the parent’s behaviour', () => {
    for (const text of everyString) {
      expect(text.toLowerCase()).not.toMatch(/you haven|you still|forgot|missed|remember to/);
    }
  });

  it('never implies a deadline or a comparison', () => {
    for (const text of everyString) {
      expect(text.toLowerCase()).not.toMatch(/should|behind|yet\b|other babies|most babies|on track/);
    }
  });

  it('invites without naming anything the child ought to be doing', () => {
    expect(AGE_BODY).toBe('Anything you’d like to remember?');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- notificationCopy
```

Expected: FAIL, `Cannot find module '../notificationCopy'`.

- [ ] **Step 3: Implement `src/features/notifications/notificationCopy.ts`**

```ts
import { CATALOGUE } from '../milestones/catalogue';
import type { Moment } from '../moments/momentQueries';

// Every string a parent can receive lives here, so the rule in spec §3 — about
// the child, never about the parent — can be asserted in one place.

const INTERVAL_WORDS: Record<number, string> = {
  2: 'Two months',
  3: 'Three months',
  6: 'Six months',
  12: 'A year',
  18: 'A year and a half',
  24: 'Two years',
};

/** "Two months ago today". Words rather than numerals: there are only six. */
export function lookBackTitle(months: number): string {
  return `${INTERVAL_WORDS[months] ?? `${months} months`} ago today`;
}

/**
 * "Wren rolled over." — the child is named, because momentTitle's "They just …"
 * is ambiguous as soon as a family has two children.
 */
export function lookBackBody(childName: string, moment: Moment): string {
  const entry = moment.milestone_id
    ? CATALOGUE.find((e) => e.id === moment.milestone_id)
    : undefined;
  if (entry) return `${childName} ${entry.verbPhrase}.`;
  // A custom moment is already in the parent's own words. An unknown milestone
  // id falls through to here rather than rendering "Wren undefined.".
  return moment.custom_title ?? '';
}

export function ageTitle(childName: string, ageText: string): string {
  return `${childName} is ${ageText} old today`;
}

/** Open-ended on purpose: never names a thing the child ought to be doing. */
export const AGE_BODY = 'Anything you’d like to remember?';
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm test -- notificationCopy && rm -f .expo/types/router.d.ts && npx tsc --noEmit
```

Expected: 9 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/notificationCopy.ts src/features/notifications/__tests__/notificationCopy.test.ts
git commit -m "feat(notifications): the words, with the copy rule as tests"
```

---

### Task 3: The plan (TDD)

The core module. Pure, no native imports, no clock of its own — `today` is an argument, so every test is deterministic.

**Files:**
- Create: `src/features/notifications/notificationPlan.ts`
- Test: `src/features/notifications/__tests__/notificationPlan.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/notifications/__tests__/notificationPlan.test.ts`:

```ts
import type { Child } from '../../children/queries';
import type { Moment } from '../../moments/momentQueries';
import { planNotifications } from '../notificationPlan';

const child = (id: string, name: string, dob: string): Child => ({
  id,
  family_id: 'f1',
  name,
  date_of_birth: dob,
  due_date: null,
});

const moment = (id: string, childId: string, occurredOn: string, title: string, photos = 0): Moment => ({
  id,
  child_id: childId,
  milestone_id: null,
  custom_title: title,
  occurred_on: occurredOn,
  note: null,
  logged_by: 'u1',
  created_at: `${occurredOn}T00:00:00.000Z`,
  moment_photos: Array.from({ length: photos }, (_, i) => ({
    id: `p${i}`,
    moment_id: id,
    storage_path: `${id}/p${i}.jpg`,
    width: 100,
    height: 80,
    position: i,
  })),
});

const TODAY = '2026-07-19';

describe('planNotifications', () => {
  it('sends nothing when reminders are off', () => {
    const wren = child('c1', 'Wren', '2026-01-15');
    expect(
      planNotifications({
        today: TODAY,
        children: [wren],
        momentsByChild: { c1: [] },
        cadence: 'off',
      }),
    ).toEqual([]);
  });

  it('sends nothing when there is no child yet', () => {
    expect(
      planNotifications({ today: TODAY, children: [], momentsByChild: {}, cadence: 'weekly' }),
    ).toEqual([]);
  });

  it('marks a monthly birthday', () => {
    const wren = child('c1', 'Wren', '2026-01-15');
    const plan = planNotifications({
      today: TODAY,
      children: [wren],
      momentsByChild: { c1: [] },
      cadence: 'weekly',
    });
    // 15 Aug is seven months after 15 Jan, and inside the eight-week window.
    expect(plan).toHaveLength(1);
    expect(plan[0].fireOn).toBe('2026-08-15');
    expect(plan[0].title).toBe('Wren is 7 months old today');
    expect(plan[0].body).toBe('Anything you’d like to remember?');
    expect(plan[0].momentId).toBeNull();
    expect(plan[0].key).toBe('age-c1-2026-08-15');
  });

  it('looks back at a moment two and three months on', () => {
    // A six-year-old has no monthly birthdays left, so only look-backs remain.
    const sol = child('c1', 'Sol', '2020-03-05');
    const plan = planNotifications({
      today: TODAY,
      children: [sol],
      momentsByChild: { c1: [moment('m1', 'c1', '2026-06-10', 'First swim')] },
      cadence: 'weekly',
    });
    expect(plan.map((n) => n.fireOn)).toEqual(['2026-08-10', '2026-09-10']);
    expect(plan[0].title).toBe('Two months ago today');
    expect(plan[0].body).toBe('First swim');
    expect(plan[0].momentId).toBe('m1');
    expect(plan[0].key).toBe('look-m1-2');
  });

  it('never looks back only one month', () => {
    const sol = child('c1', 'Sol', '2020-03-05');
    const plan = planNotifications({
      today: TODAY,
      children: [sol],
      momentsByChild: { c1: [moment('m1', 'c1', '2026-07-01', 'Too recent')] },
      cadence: 'weekly',
    });
    // 1 Aug would be one month on. A month is not yet a memory.
    expect(plan.map((n) => n.fireOn)).not.toContain('2026-08-01');
  });

  it('schedules nothing for today or earlier', () => {
    const sol = child('c1', 'Sol', '2020-03-05');
    const plan = planNotifications({
      today: TODAY,
      children: [sol],
      // Two months on from this is 19 July — today. A notification for now is no
      // use: it would be scheduled in the past and never fire. The three-month
      // look-back on 19 August is still legitimate, so the plan is not empty —
      // it simply must not contain today.
      momentsByChild: { c1: [moment('m1', 'c1', '2026-05-19', 'Exactly today')] },
      cadence: 'weekly',
    });
    expect(plan.map((n) => n.fireOn)).toEqual(['2026-08-19']);
    expect(plan.every((n) => n.fireOn > TODAY)).toBe(true);
  });

  it('gives a week to the birthday when both fall in it', () => {
    const wren = child('c1', 'Wren', '2026-01-15');
    const plan = planNotifications({
      today: TODAY,
      children: [wren],
      // Two months on from 14 June is 14 Aug — the same week as the 15 Aug
      // birthday. An age moment happens once and cannot be deferred.
      momentsByChild: { c1: [moment('m1', 'c1', '2026-06-14', 'Same week')] },
      cadence: 'weekly',
    });
    const thatWeek = plan.filter((n) => n.fireOn >= '2026-08-10' && n.fireOn <= '2026-08-16');
    expect(thatWeek).toHaveLength(1);
    expect(thatWeek[0].title).toBe('Wren is 7 months old today');
  });

  it('prefers a moment that has a photo', () => {
    const sol = child('c1', 'Sol', '2020-03-05');
    const plan = planNotifications({
      today: TODAY,
      children: [sol],
      momentsByChild: {
        c1: [
          moment('m1', 'c1', '2026-06-10', 'No photo'),
          moment('m2', 'c1', '2026-06-11', 'Has a photo', 1),
        ],
      },
      cadence: 'weekly',
    });
    // 10 and 11 Aug are the same week; the one with something to look at wins.
    expect(plan[0].body).toBe('Has a photo');
  });

  it('prefers the longer look-back when nothing else separates them', () => {
    const sol = child('c1', 'Sol', '2020-03-05');
    const plan = planNotifications({
      today: TODAY,
      children: [sol],
      momentsByChild: {
        c1: [
          moment('m1', 'c1', '2026-06-10', 'Two months on'),
          moment('m2', 'c1', '2026-02-11', 'Six months on'),
        ],
      },
      cadence: 'weekly',
    });
    // Both land in the week of 10 Aug. Six months back lands harder than two.
    expect(plan[0].body).toBe('Six months on');
  });

  it('shares the weeks out between children', () => {
    // Twins, so every candidate collides and rotation is the only thing that can
    // separate them.
    const wren = child('c1', 'Wren', '2026-01-15');
    const sol = child('c2', 'Sol', '2026-01-15');
    const plan = planNotifications({
      today: TODAY,
      children: [wren, sol],
      momentsByChild: { c1: [], c2: [] },
      cadence: 'weekly',
      weeks: 12,
    });
    // One notification per week, never two — and the second child gets the next
    // one rather than being crowded out for ever.
    expect(plan.map((n) => n.fireOn)).toEqual(['2026-08-15', '2026-09-15']);
    expect(plan.map((n) => n.childId)).toEqual(['c1', 'c2']);
  });

  it('drops to one a month when asked', () => {
    const sol = child('c1', 'Sol', '2020-03-05');
    const plan = planNotifications({
      today: TODAY,
      children: [sol],
      momentsByChild: {
        c1: [
          moment('m1', 'c1', '2026-06-05', 'Early August'),
          moment('m2', 'c1', '2026-06-25', 'Late August'),
        ],
      },
      cadence: 'monthly',
      weeks: 12,
    });
    const august = plan.filter((n) => n.fireOn.startsWith('2026-08'));
    expect(august).toHaveLength(1);
  });

  it('fires at half past seven, after a bedtime', () => {
    const wren = child('c1', 'Wren', '2026-01-15');
    const plan = planNotifications({
      today: TODAY,
      children: [wren],
      momentsByChild: { c1: [] },
      cadence: 'weekly',
    });
    expect(plan[0].fireAtHour).toBe(19);
    expect(plan[0].fireAtMinute).toBe(30);
  });

  it('counts a premature baby’s months from their due date', () => {
    // Corrected age, as everywhere else in the app. Born 15 Jan, due 26 Feb: the
    // monthly marks land on the 26th, not the 15th, and that is the whole tell.
    const wren: Child = { ...child('c1', 'Wren', '2026-01-15'), due_date: '2026-02-26' };
    const plan = planNotifications({
      today: TODAY,
      children: [wren],
      momentsByChild: { c1: [] },
      cadence: 'weekly',
    });
    expect(plan.map((n) => n.fireOn)).toEqual(['2026-07-26', '2026-08-26']);
    expect(plan[0].title).toBe('Wren is 5 months old today');
  });

  it('stays inside its window', () => {
    const sol = child('c1', 'Sol', '2020-03-05');
    const plan = planNotifications({
      today: TODAY,
      children: [sol],
      // Two months on is 1 Aug, inside a two-week window; three months on is
      // 1 Sep, outside it. iOS allows only 64 pending local notifications, so
      // the scheduler windows rather than planning a child's whole future.
      momentsByChild: { c1: [moment('m1', 'c1', '2026-06-01', 'Inside')] },
      cadence: 'weekly',
      weeks: 2,
    });
    expect(plan.map((n) => n.fireOn)).toEqual(['2026-08-01']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- notificationPlan
```

Expected: FAIL, `Cannot find module '../notificationPlan'`.

- [ ] **Step 3: Implement `src/features/notifications/notificationPlan.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm test -- notificationPlan && rm -f .expo/types/router.d.ts && npx tsc --noEmit
```

Expected: 14 passed; tsc exit 0.

If a date assertion fails, **do not adjust the expectation to match the output.** Work out which is right first — these dates were computed by hand and one of us is wrong. Report which.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/notificationPlan.ts src/features/notifications/__tests__/notificationPlan.test.ts
git commit -m "feat(notifications): the plan — the child's calendar, never the parent's behaviour"
```

---

### Task 4: The cadence setting (TDD)

**Files:**
- Create: `src/features/notifications/notificationSettings.ts`
- Test: `src/features/notifications/__tests__/notificationSettings.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/notifications/__tests__/notificationSettings.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNotificationCadence } from '../notificationSettings';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedStorage.setItem.mockResolvedValue(undefined);
});

describe('useNotificationCadence', () => {
  it('starts weekly', async () => {
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useNotificationCadence());
    await waitFor(() => expect(result.current.cadence).toBe('weekly'));
  });

  it('restores a stored choice', async () => {
    mockedStorage.getItem.mockResolvedValue('monthly');
    const { result } = await renderHook(() => useNotificationCadence());
    await waitFor(() => expect(result.current.cadence).toBe('monthly'));
  });

  it('remembers a change', async () => {
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useNotificationCadence());
    await waitFor(() => expect(result.current.cadence).toBe('weekly'));

    // RNTL's act() returns a thenable even for a synchronous callback, and an
    // unawaited one leaks a broken act environment into the next test.
    await act(() => result.current.setCadence('off'));

    await waitFor(() => expect(result.current.cadence).toBe('off'));
    expect(mockedStorage.setItem).toHaveBeenCalledWith('notification-cadence', 'off');
  });

  it('ignores a value it does not recognise', async () => {
    // Including 'daily', which this app deliberately never offers.
    mockedStorage.getItem.mockResolvedValue('daily');
    const { result } = await renderHook(() => useNotificationCadence());
    await waitFor(() => expect(result.current.cadence).toBe('weekly'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- notificationSettings
```

Expected: FAIL, `Cannot find module '../notificationSettings'`.

- [ ] **Step 3: Implement `src/features/notifications/notificationSettings.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import type { NotificationCadence } from './notificationPlan';

const STORAGE_KEY = 'notification-cadence';

// Weekly is enough to keep a memory book in mind, and a memory book that pings
// daily is a different and worse product. There is deliberately no Daily option
// to store: offering it would be offering the setting that does the damage.
const DEFAULT_CADENCE: NotificationCadence = 'weekly';

export function useNotificationCadence(): {
  cadence: NotificationCadence;
  setCadence: (next: NotificationCadence) => void;
} {
  const [cadence, setLocalCadence] = useState<NotificationCadence>(DEFAULT_CADENCE);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      if (stored === 'weekly' || stored === 'monthly' || stored === 'off') setLocalCadence(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setCadence = (next: NotificationCadence) => {
    setLocalCadence(next);
    // Fire and forget: the setting must not wait on disk to feel instant.
    void AsyncStorage.setItem(STORAGE_KEY, next);
  };

  return { cadence, setCadence };
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm test -- notificationSettings && rm -f .expo/types/router.d.ts && npx tsc --noEmit
```

Expected: 4 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/notificationSettings.ts src/features/notifications/__tests__/notificationSettings.test.ts
git commit -m "feat(notifications): a cadence that offers no daily option"
```

---

### Task 5: When to ask (TDD)

Notification permission is one-shot: refused once, effectively gone. The standard way to lose it is to ask on first launch, before the app has earned anything.

**Files:**
- Create: `src/features/notifications/permission.ts`
- Test: `src/features/notifications/__tests__/permission.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/notifications/__tests__/permission.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNotificationPermission } from '../permission';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedStorage.setItem.mockResolvedValue(undefined);
});

describe('useNotificationPermission', () => {
  it('does not ask a parent who has barely started', async () => {
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useNotificationPermission(2));
    await waitFor(() => expect(result.current.shouldAsk).toBe(false));
  });

  it('asks once the app has shown what it is for', async () => {
    // Three captured moments: enough to have felt the point of it.
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useNotificationPermission(3));
    await waitFor(() => expect(result.current.shouldAsk).toBe(true));
  });

  it('never asks twice', async () => {
    // One-shot: a second prompt cannot succeed and only annoys.
    mockedStorage.getItem.mockResolvedValue('true');
    const { result } = await renderHook(() => useNotificationPermission(10));
    await waitFor(() => expect(result.current.shouldAsk).toBe(false));
  });

  it('remembers that it asked', async () => {
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useNotificationPermission(3));
    await waitFor(() => expect(result.current.shouldAsk).toBe(true));

    await act(() => result.current.markAsked());

    await waitFor(() => expect(result.current.shouldAsk).toBe(false));
    expect(mockedStorage.setItem).toHaveBeenCalledWith('notification-permission-asked', 'true');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- permission
```

Expected: FAIL, `Cannot find module '../permission'`.

- [ ] **Step 3: Implement `src/features/notifications/permission.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'notification-permission-asked';

// Asking on first launch is the standard way to lose permission for good: the
// request arrives before the app has shown what it is for, and a refusal is
// final. Three captured moments is enough to have felt the point of it.
const MOMENTS_BEFORE_ASKING = 3;

/**
 * `momentCount` comes from data the app has already loaded — there is no stored
 * counter to drift out of step with the timeline.
 */
export function useNotificationPermission(momentCount: number): {
  shouldAsk: boolean;
  markAsked: () => void;
} {
  const [asked, setAsked] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Assume asked until storage says otherwise, so a slow read can never cause
    // a prompt to flash up on launch.
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!cancelled) setAsked(stored === 'true');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const markAsked = () => {
    setAsked(true);
    void AsyncStorage.setItem(STORAGE_KEY, 'true');
  };

  return { shouldAsk: !asked && momentCount >= MOMENTS_BEFORE_ASKING, markAsked };
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm test -- permission && rm -f .expo/types/router.d.ts && npx tsc --noEmit
```

Expected: 4 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/permission.ts src/features/notifications/__tests__/permission.test.ts
git commit -m "feat(notifications): ask after the third moment, and only once"
```

---

### Task 6: The shell over expo-notifications

The only file here that touches native code. It has no unit tests — its logic lives in `notificationPlan`, and what remains is calls into a native module that a test would only be mocking back at itself.

**Files:**
- Create: `src/features/notifications/scheduler.ts`

- [ ] **Step 1: Install**

```bash
npx expo install expo-notifications
```

- [ ] **Step 2: Implement `src/features/notifications/scheduler.ts`**

```ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { PlannedNotification } from './notificationPlan';

// Android drops every notification in silence if no channel exists — no error,
// nothing delivered. Default importance so a parent can quieten or mute this in
// system settings without having to disable the app.
const ANDROID_CHANNEL_ID = 'moments';

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Moments and anniversaries',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Ask for permission. Alert and sound, but deliberately no badge: an unread
 * count on the app icon is a small pressure mechanic, and the wrong tone here.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return status === 'granted';
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Cancel everything and reschedule from the plan. The plan is deterministic
 * given its inputs, so rebuilding wholesale is both the simplest and the safest
 * thing to do — there is no partial state to reconcile.
 */
export async function applyNotificationPlan(plan: PlannedNotification[]): Promise<void> {
  // expo-notifications cannot schedule on web. Web is a development surface
  // here, so the feature is absent rather than broken: no throw, no prompt.
  if (Platform.OS === 'web') return;

  await ensureAndroidChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!(await hasNotificationPermission())) return;

  for (const notification of plan) {
    const [year, month, day] = notification.fireOn.split('-').map(Number);
    await Notifications.scheduleNotificationAsync({
      identifier: notification.key,
      content: {
        title: notification.title,
        body: notification.body,
        data: { childId: notification.childId, momentId: notification.momentId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        // Local time: 19:30 where the parent is, not where the server is.
        date: new Date(year, month - 1, day, notification.fireAtHour, notification.fireAtMinute),
        channelId: ANDROID_CHANNEL_ID,
      },
    });
  }
}
```

- [ ] **Step 3: Verify it compiles and nothing else broke**

```bash
rm -f .expo/types/router.d.ts && npx tsc --noEmit && npm test
```

Expected: tsc exit 0; full suite green. There are no new tests — that is deliberate and explained above.

- [ ] **Step 4: Commit**

```bash
git add src/features/notifications/scheduler.ts package.json package-lock.json
git commit -m "feat(notifications): the native shell — channel first, cancel and rebuild"
```

---

### Task 7: App configuration and the icon

**Files:**
- Modify: `app.json`
- Create: `assets/images/notification-icon.png`

- [ ] **Step 1: Create the notification icon.** This asset does not exist and cannot be generated by this plan — it is a real prerequisite, not a step to wave through.

Android draws the notification icon as a **silhouette**: every non-transparent pixel becomes white, whatever colour it was. Supplying the existing app icon produces a featureless grey square in the status bar.

Required: `assets/images/notification-icon.png`, 96×96, **white shape on a fully transparent background**, no gradients and no anti-aliased colour fringing. If one is not available yet, say so and stop rather than shipping the grey square — it is the kind of thing that survives to production because nobody looks at an Android status bar during review.

- [ ] **Step 2: Register the plugin.** In `app.json`, add to the `plugins` array, after `"@react-native-community/datetimepicker"`:

```json
      [
        "expo-notifications",
        {
          "icon": "./assets/images/notification-icon.png",
          "color": "#833045"
        }
      ]
```

`#833045` is damson, the app's accent, used by Android to tint the silhouette.

- [ ] **Step 3: Verify the config resolves**

```bash
npx expo config --type public > /dev/null && echo "config OK"
```

Expected: `config OK`. This fails if the icon path does not exist, which is the point.

- [ ] **Step 4: Commit**

```bash
git add app.json assets/images/notification-icon.png
git commit -m "chore(notifications): register the plugin with a monochrome Android icon"
```

---

### Task 8: Wire it into the app

**Files:**
- Create: `src/features/notifications/useNotificationSync.ts`
- Modify: `src/app/(app)/(tabs)/family.tsx`

- [ ] **Step 1: Create the sync hook.** Create `src/features/notifications/useNotificationSync.ts`:

```ts
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { toIsoDate } from '@/lib/date';
import type { Child } from '../children/queries';
import type { Moment } from '../moments/momentQueries';
import { planNotifications, type NotificationCadence } from './notificationPlan';
import { applyNotificationPlan } from './scheduler';

/**
 * Rebuilds the schedule whenever anything it depends on changes: the cadence,
 * the children, their moments, or the app coming back to the foreground (which
 * also covers the day simply having changed while the app sat open).
 */
export function useNotificationSync(
  children: Child[],
  momentsByChild: Record<string, Moment[]>,
  cadence: NotificationCadence,
): void {
  useEffect(() => {
    const rebuild = () => {
      void applyNotificationPlan(
        planNotifications({
          today: toIsoDate(new Date()),
          children,
          momentsByChild,
          cadence,
        }),
      );
    };

    rebuild();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') rebuild();
    });
    return () => subscription.remove();
  }, [children, momentsByChild, cadence]);
}
```

- [ ] **Step 2: Add the Reminders section to the Family screen.** In `src/app/(app)/(tabs)/family.tsx`, add these imports beside the existing `@/features` ones:

```tsx
import { useNotificationCadence } from '@/features/notifications/notificationSettings';
import type { NotificationCadence } from '@/features/notifications/notificationPlan';
```

Add `Platform` to the existing `react-native` import, and inside the component beside the other hooks:

```tsx
  const { cadence, setCadence } = useNotificationCadence();
```

Then render this **above** the existing `Your data` section:

```tsx
          {/* expo-notifications cannot schedule on web, so the row is absent
              there rather than present and inert. */}
          {Platform.OS !== 'web' ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>Reminders</Text>
              <Text style={styles.blurb}>
                A quiet note when your little one turns a month older, or when something you saved a
                few months ago comes round again.
              </Text>
              <View style={styles.cadenceRow}>
                {(['weekly', 'monthly', 'off'] as NotificationCadence[]).map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setCadence(option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: cadence === option }}
                    accessibilityLabel={`Remind me ${option}`}
                    style={[styles.cadence, cadence === option && styles.cadenceActive]}
                  >
                    <Text style={cadence === option ? styles.cadenceTextActive : styles.cadenceText}>
                      {option === 'weekly' ? 'Weekly' : option === 'monthly' ? 'Monthly' : 'Off'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
```

- [ ] **Step 3: Add the styles.** In the `StyleSheet.create` block of `family.tsx`, beside the existing `section` / `sectionHeading` / `blurb` keys:

```tsx
  cadenceRow: { flexDirection: 'row', gap: space.xl, marginTop: space.xs },
  // Selection is an underline, never a pill (DESIGN.md).
  cadence: { paddingBottom: space.xs, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  cadenceActive: { borderBottomColor: color.damson },
  cadenceText: { fontFamily: font.medium, fontSize: type.label, color: color.inkMuted },
  cadenceTextActive: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
```

- [ ] **Step 4: Verify**

```bash
rm -f .expo/types/router.d.ts && npx tsc --noEmit && npm test
```

Expected: tsc exit 0; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/useNotificationSync.ts "src/app/(app)/(tabs)/family.tsx"
git commit -m "feat(notifications): rebuild the schedule on change, and a Reminders setting"
```

---

### Task 9: Gates and runtime verification

**Files:** none new.

- [ ] **Step 1: Full local gates**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test && npx supabase test db
```

Expected: tsc exit 0; Jest green (210 existing plus roughly 35 new); pgTAP 52 assertions pass.

- [ ] **Step 2: Web export smoke check**

```bash
npx expo export --platform web > /dev/null 2>&1 && echo "export OK" && rm -rf dist
```

Expected: `export OK`.

- [ ] **Step 3: Verify the web behaviour — absence, not breakage**

Open the Family tab in the browser. Confirm: **no Reminders section**, no permission prompt, and nothing in the console. The scheduler must be a silent no-op, not a caught error.

- [ ] **Step 4: Verify on Android — and note this needs nothing from Apple**

This is the step worth doing carefully, because it can be done **today**: a development build and an emulator, no Apple Developer account, no bundle identifier, no certificates.

```bash
npx expo run:android
```

Confirm:

1. The Reminders section appears, defaults to Weekly, and the underline moves when you change it.
2. On Android 13+, the permission prompt appears — and appears **after** the third captured moment, not on launch. On Android 12 and below there is no prompt at all, which is correct.
3. A notification is delivered. To check without waiting for a real anniversary, temporarily add a moment dated exactly two months ago and confirm one is scheduled for 19:30 today.
4. **The icon is a silhouette, not a grey square.** This is the one that quietly ships broken.
5. The channel "Moments and anniversaries" appears under the app's system notification settings, and muting it there stops delivery while leaving the app alone.
6. Setting Reminders to Off cancels everything: nothing is delivered afterwards.

- [ ] **Step 5: iOS — deferred, and left unchecked**

iOS needs a development build, which needs the bundle identifier from Plan 5 Task 5, which needs the Apple Developer account.

**Leave this step unticked and say so.** Do not mark the task complete on the strength of Android alone. When the account exists, check: delivery, that permission is requested once and only after the third moment, and that **no badge** appears on the app icon.

---

## Self-review

**Spec coverage.** §2 the months-not-years window — Task 3's `LOOK_BACK_MONTHS`. §3 the trigger rule — enforced structurally (`planNotifications` takes children and moments and has no parameter through which parent activity could reach it) and by the copy tests in Task 2. §4.1 look-back and §4.2 age — Task 3. §4.3 the excluded "milestones opening" type — correctly absent; there is no task for it and no code path that could produce one. §5 weekly cap, priority order, 19:30, the settings — Tasks 3, 4 and 8. §6 permission timing — Task 5. §7 architecture and §7.1 the platform differences — Tasks 6, 7 and 9. §8 privacy — no analytics, no logging, and nothing leaves the device; there is nothing to build, which is the point. §9 testing — every task is test-first except Task 6, justified in place.

**Deliberate gaps.** `scheduler.ts` has no unit tests: it is calls into a native module, and a test would mock the module and then assert the mock. Its correctness is established in Task 9 on a device. The rolling window is not adaptive — eight weeks at one per week uses eight of the 64 iOS slots, so there is a wide margin and no need for cleverness. Tapping a notification does not yet deep-link to the moment; the `data` payload carries `momentId` so that it can later, but routing from a notification is its own piece of work and is not in this plan.

**Type consistency.** `NotificationCadence` and `PlannedNotification` are defined in Task 3 and consumed in Tasks 4, 6 and 8. `planNotifications` takes `{today, children, momentsByChild, cadence, weeks?}` throughout. `lookBackTitle`/`lookBackBody`/`ageTitle`/`AGE_BODY` are defined in Task 2 and used in Task 3. `addMonths` is moved in Task 1 and used in Task 3. `useNotificationCadence` returns `{cadence, setCadence}` (Task 4) and is destructured that way in Task 8. `useNotificationPermission(momentCount)` returns `{shouldAsk, markAsked}` (Task 5). `toIsoDate` and `Child`/`Moment` match the shipped modules.

**One risk to name.** Task 3 is the largest single test file in the plan, and its date arithmetic is unforgiving. If an expectation disagrees with the implementation, the instruction in Task 3 Step 4 is deliberate: work out which is wrong and report it, rather than editing the expectation to match the output. Four bugs were found that way on the spine timeline, and every one was in the plan rather than the code.

**Four expectations in Task 3 were wrong when first written, and were corrected by running the algorithm before this plan was committed:**

- *"sends nothing about today or the past"* expected an empty plan, forgetting that the same moment's **three**-month look-back also lands inside the window. It now asserts that nothing is scheduled for today, which was the actual point.
- The rotation test gave its two children birthdays a day apart, which put them in **different** rolling weeks — so it proved nothing about rotation. They are now twins, and the assertion is that consecutive weeks go to different children.
- The corrected-age test expected the first notification on `2026-08-26`, missing that the **five**-month mark on `2026-07-26` also falls in the window. Both are now asserted, which tests the due-date origin more precisely anyway.
- The window test used a child with no candidates at all, so `every()` passed vacuously on an empty array. It now uses a moment that straddles the horizon, with one candidate inside and one outside.
