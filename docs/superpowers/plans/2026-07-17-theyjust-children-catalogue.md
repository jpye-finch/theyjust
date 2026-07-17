# TheyJust Children & Milestone Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A parent can add their children (with corrected age for premature babies) and see the full curated milestone catalogue with clinical typical-age ranges, per child, in the app.

**Architecture:** Pure logic first (age math, range phrasing, catalogue data — all TDD), then TanStack Query hooks over the existing RLS-protected `children`/`moments` tables, then UI (tab shell, Family screen with child CRUD, Milestones screen). No schema changes — the Plan 1 database already supports everything here. The catalogue ships as app-bundled typed data with a structural validation test; ranges are compiled from WHO/CDC/NHS during Task 5 with ≥2 sources per entry.

**Tech Stack:** Existing Expo SDK 57 + TypeScript + jest-expo + Supabase stack from Plan 1, plus `@tanstack/react-query` v5 (spec §2).

**This is Plan 2 of 4.** Spec: `docs/superpowers/specs/2026-07-16-theyjust-milestone-tracker-design.md` (§3–§5). Plan 1 delivered auth + schema + RLS. Plan 3 adds moment capture/photos/timeline (so this plan's "achieved" display will show data as soon as Plan 3 lands — it reads the already-existing `moments` table, which is simply empty for now). Plan 4 adds invites/export/deletion.

**Conventions (established in Plan 1):**
- Plan code blocks are kept byte-identical to shipped files; implementers verify with scripted diffs. When reality beats the plan (API changes), fix the code first, report the final file, and the coordinator syncs the plan.
- Implementers stage only their own files (never `git add -A`); reviewers are strictly read-only (never `npm run lint` — Expo's lint scaffolds config).
- Source files under `src/features/` use **relative imports** (so Jest needs no moduleNameMapper); only files under `src/app/` use the `@/` alias.
- Work on branch `children-catalogue` (created from `main` at execution start).
- No DB changes in this plan: pgTAP stays at 3 files / 44 assertions; CI is unchanged.

**File structure (all new unless noted):**

```
src/lib/queryClient.ts                                  TanStack Query client
src/app/_layout.tsx                                     MODIFIED: wrap in QueryClientProvider
src/features/children/age.ts                            pure age math (chronological, corrected, formatting)
src/features/children/__tests__/age.test.ts
src/features/children/queries.ts                        useChildren/useCreateChild/useUpdateChild + ensureFamilyId
src/features/children/__tests__/queries.test.ts
src/features/children/ChildForm.tsx                     add/edit child form
src/features/children/__tests__/ChildForm.test.tsx
src/features/children/selectedChild.tsx                 selected-child context + hook
src/features/milestones/catalogue.ts                    types + the 40-entry catalogue
src/features/milestones/__tests__/catalogue.test.ts     structural validation (content can't rot)
src/features/milestones/rangePhrase.ts                  range/achieved/signpost phrasing rules
src/features/milestones/__tests__/rangePhrase.test.ts
src/features/milestones/achievements.ts                 moments→achievement map + useMoments hook
src/features/milestones/__tests__/achievements.test.ts
src/features/milestones/MilestoneRow.tsx                presentational row
src/features/milestones/__tests__/MilestoneRow.test.tsx
src/app/(app)/_layout.tsx                               MODIFIED: Tabs + SelectedChildProvider
src/app/(app)/index.tsx                                 MODIFIED: redirect to /milestones
src/app/(app)/milestones.tsx                            Milestones screen
src/app/(app)/family.tsx                                Family screen (children CRUD + sign out)
```

---

### Task 1: Branch, TanStack Query, and provider wiring

**Files:**
- Create: `src/lib/queryClient.ts`
- Modify: `src/app/_layout.tsx`
- Modify: `package.json` (+ lockfile, via install)

- [ ] **Step 1: Create the branch**

```bash
git checkout main && git pull --ff-only 2>/dev/null; git checkout -b children-catalogue
```

- [ ] **Step 2: Install TanStack Query**

```bash
npm install @tanstack/react-query@^5
npx expo install --check
```

Expected: install succeeds; `expo install --check` reports dependencies up to date (react-query is not SDK-managed, so it won't be flagged).

- [ ] **Step 3: Create `src/lib/queryClient.ts`**

```ts
import { AppState } from 'react-native';
import { focusManager, QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data changes only when this family writes, so a short stale window
      // avoids refetch storms. Refresh-on-foreground works because we wire
      // AppState into focusManager below (TanStack's DOM listeners are inert
      // on native).
      staleTime: 30_000,
    },
  },
});

// TanStack's documented React Native pattern: report foreground/background so
// refetchOnWindowFocus fires when the app becomes active.
AppState.addEventListener('change', (status) => {
  focusManager.setFocused(status === 'active');
});
```

Also (from Task 1's quality review): `src/features/auth/useSession.ts` gains a
privacy guard — on the `SIGNED_OUT` auth event the query cache is cleared so a
second account on a shared device can never see the previous family's cached
data. The onAuthStateChange callback becomes:

```ts
    } = supabase.auth.onAuthStateChange((event, next) => {
      // A signed-out device must hold no family data in memory: the next
      // account to sign in must never see the previous family's cache.
      if (event === 'SIGNED_OUT') queryClient.clear();
      setSession(next);
    });
```

with `import { queryClient } from '../../lib/queryClient';` added to the imports.

- [ ] **Step 4: Wrap the root layout**

Replace `src/app/_layout.tsx` with:

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/features/auth/useSession';
import { queryClient } from '@/lib/queryClient';

export default function RootLayout() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: Guard Jest against stray tool worktrees, then verify**

Background tooling occasionally parks git worktrees under `.claude/worktrees/`,
which Jest's default scan would pick up (doubling suite counts). Add to the
`jest` block in `package.json`:

```json
"testPathIgnorePatterns": ["/node_modules/", "/.claude/"]
```

```bash
npx tsc --noEmit && npm test
```

Expected: tsc exit 0; 3 suites / 7 tests still green.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/queryClient.ts src/app/_layout.tsx
git commit -m "feat: TanStack Query client and provider"
```

---

### Task 2: Age module — chronological, corrected, formatting (TDD)

Corrected age is the heart of the "is this normal?" feature for premature babies: compare against the range using age from the *due date* until 24 months corrected, then switch to chronological (spec §5).

**Files:**
- Create: `src/features/children/age.ts`
- Test: `src/features/children/__tests__/age.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/children/__tests__/age.test.ts`:

```ts
import { ageInMonths, ageParts, childAge, formatAgeParts, formatChildAge } from '../age';

describe('ageParts', () => {
  it('computes whole months and remainder weeks', () => {
    expect(ageParts('2026-01-15', '2026-05-29')).toEqual({ months: 4, weeks: 2 });
  });

  it('handles under one month as weeks only', () => {
    expect(ageParts('2026-01-01', '2026-01-22')).toEqual({ months: 0, weeks: 3 });
  });

  it('treats the clamped month-end as the monthly anniversary (Jan 31 → Feb 28)', () => {
    // A baby born Jan 31 turns one month on Feb 28 — in a shorter month, the
    // last day IS the anniversary (standard clamped-anniversary convention).
    expect(ageParts('2026-01-31', '2026-02-28')).toEqual({ months: 1, weeks: 0 });
  });

  it('is zero on the day of birth', () => {
    expect(ageParts('2026-03-10', '2026-03-10')).toEqual({ months: 0, weeks: 0 });
  });
});

describe('ageInMonths', () => {
  it('is exact on month anniversaries', () => {
    expect(ageInMonths('2026-01-01', '2026-07-01')).toBe(6);
  });

  it('adds a day-based fraction between anniversaries', () => {
    expect(ageInMonths('2026-01-01', '2026-07-16')).toBeCloseTo(6.49, 1);
  });
});

describe('childAge', () => {
  it('has no corrected age for term babies (due_date null)', () => {
    const a = childAge('2026-01-01', null, '2026-07-01');
    expect(a.corrected).toBeNull();
    expect(a.chronological).toEqual({ months: 6, weeks: 0 });
    expect(a.comparisonMonths).toBe(6);
  });

  it('uses corrected age for comparisons when premature', () => {
    const a = childAge('2026-01-01', '2026-03-01', '2026-07-01');
    expect(a.chronological).toEqual({ months: 6, weeks: 0 });
    expect(a.corrected).toEqual({ months: 4, weeks: 0 });
    expect(a.comparisonMonths).toBe(4);
  });

  it('stops correcting at 24 months corrected (standard practice)', () => {
    const a = childAge('2024-01-01', '2024-03-01', '2026-03-15');
    expect(a.corrected).toBeNull();
    expect(a.comparisonMonths).toBeCloseTo(26.46, 1);
  });

  it('still corrects just under the cutoff', () => {
    const a = childAge('2024-01-01', '2024-03-01', '2026-02-15');
    expect(a.corrected).toEqual({ months: 23, weeks: 2 });
    expect(a.comparisonMonths).toBeCloseTo(23.46, 1);
  });
});

describe('formatAgeParts', () => {
  it('formats months and weeks', () => {
    expect(formatAgeParts({ months: 4, weeks: 2 })).toBe('4 months, 2 weeks');
  });

  it('omits zero weeks', () => {
    expect(formatAgeParts({ months: 6, weeks: 0 })).toBe('6 months');
  });

  it('uses singular forms', () => {
    expect(formatAgeParts({ months: 1, weeks: 1 })).toBe('1 month, 1 week');
  });

  it('formats under a month as weeks', () => {
    expect(formatAgeParts({ months: 0, weeks: 3 })).toBe('3 weeks');
  });

  it('handles the first days of life', () => {
    expect(formatAgeParts({ months: 0, weeks: 0 })).toBe('less than a week');
  });

  it('switches to years from 24 months', () => {
    expect(formatAgeParts({ months: 27, weeks: 1 })).toBe('2 years, 3 months');
    expect(formatAgeParts({ months: 24, weeks: 0 })).toBe('2 years');
  });
});

describe('formatChildAge', () => {
  it('shows only chronological for term children', () => {
    expect(formatChildAge(childAge('2026-01-01', null, '2026-07-01'))).toBe('6 months');
  });

  it('shows both ages for premature children', () => {
    expect(formatChildAge(childAge('2026-01-01', '2026-03-01', '2026-07-01'))).toBe(
      '6 months — 4 months corrected',
    );
  });
});

describe('Date-instant inputs (local calendar semantics)', () => {
  // jest.setup.js pins TZ=America/Los_Angeles, so late evening local is
  // already "tomorrow" in UTC — these fail if UTC getters sneak back in.
  it('reads a Date as the local calendar date, not UTC', () => {
    expect(ageParts('2026-01-01', new Date(2026, 0, 14, 23, 30))).toEqual({
      months: 0,
      weeks: 1,
    });
  });

  it('accepts Date instants in childAge', () => {
    const a = childAge('2026-01-01', null, new Date(2026, 6, 1, 12, 0));
    expect(a.chronological).toEqual({ months: 6, weeks: 0 });
  });
});

describe('boundaries and monotonicity', () => {
  it('wraps a single month across the year boundary', () => {
    expect(ageParts('2025-12-15', '2026-01-15')).toEqual({ months: 1, weeks: 0 });
  });

  it('never decreases as time advances (two years, day by day)', () => {
    let prev = -1;
    const start = Date.UTC(2026, 0, 31); // month-end DOB stresses clamping
    for (let i = 0; i <= 730; i++) {
      const on = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const m = ageInMonths('2026-01-31', on);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- age
```

Expected: FAIL — `Cannot find module '../age'`.

- [ ] **Step 3: Implement `src/features/children/age.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- age
```

Expected: all age tests pass (22 tests).

Also (from Task 2's quality review): `jest.setup.js` gains a deterministic
timezone pin as its FIRST lines, so UTC-vs-local leaks fail in CI too:

```js
// Deterministic non-UTC timezone: UTC-vs-local leaks must fail in CI too.
process.env.TZ = 'America/Los_Angeles';
```

- [ ] **Step 5: Commit**

```bash
git add src/features/children/age.ts src/features/children/__tests__/age.test.ts
git commit -m "feat: age math — chronological, corrected with 24-month cutoff, formatting"
```

---

### Task 3: Range phrasing (TDD)

Spec §5's safety rules as code: never a deadline, always a range; a calm signpost only once the child's comparison age is more than 2 months past the outer bound.

**Files:**
- Create: `src/features/milestones/rangePhrase.ts`
- Test: `src/features/milestones/__tests__/rangePhrase.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/milestones/__tests__/rangePhrase.test.ts`:

```ts
import { milestoneStatus, rangeText, SIGNPOST_TEXT } from '../rangePhrase';

const entry = {
  id: 'first_steps',
  title: 'First steps',
  verbPhrase: 'took their first steps',
  category: 'motor' as const,
  typicalStartMonths: 8,
  typicalEndMonths: 18,
  context: 'Walking has one of the widest healthy windows of any milestone.',
  sources: ['https://www.who.int/x', 'https://www.cdc.gov/y'],
};

describe('rangeText', () => {
  it('phrases a range', () => {
    expect(rangeText(8, 18)).toBe('Typically emerges between 8 and 18 months');
  });

  it('phrases from-birth ranges without a zero', () => {
    expect(rangeText(0, 3)).toBe('Typically emerges in the first 3 months');
  });

  it('uses singular month', () => {
    expect(rangeText(0, 1)).toBe('Typically emerges in the first month');
  });

  it('phrases toddler ranges in years, matching how ages display past 24 months', () => {
    expect(rangeText(30, 48)).toBe('Typically emerges between 2½ and 4 years');
    expect(rangeText(24, 36)).toBe('Typically emerges between 2 and 3 years');
    expect(rangeText(18, 30)).toBe('Typically emerges between 18 months and 2½ years');
  });
});

describe('milestoneStatus', () => {
  it('celebrates achieved milestones regardless of timing', () => {
    expect(milestoneStatus(entry, 30, '20 months')).toEqual({
      kind: 'achieved',
      ageText: '20 months',
    });
  });

  it('shows the range before and inside the window', () => {
    expect(milestoneStatus(entry, 5, null)).toEqual({
      kind: 'range',
      text: 'Typically emerges between 8 and 18 months',
    });
    expect(milestoneStatus(entry, 18, null).kind).toBe('range');
  });

  it('stays calm up to two months past the outer bound', () => {
    expect(milestoneStatus(entry, 20, null).kind).toBe('range');
  });

  it('adds the gentle signpost beyond outer bound + 2 months', () => {
    expect(milestoneStatus(entry, 20.1, null)).toEqual({
      kind: 'range-with-signpost',
      text: 'Typically emerges between 8 and 18 months',
      signpost: SIGNPOST_TEXT,
    });
  });

  it('never signposts commonly-skipped milestones', () => {
    expect(milestoneStatus({ ...entry, skippable: true }, 25, null).kind).toBe('range');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- rangePhrase
```

Expected: FAIL — `Cannot find module '../rangePhrase'`.

- [ ] **Step 3: Implement `src/features/milestones/rangePhrase.ts`**

```ts
// Spec §5 safety rules, encoded once:
//  - Achieved milestones are celebrated regardless of timing.
//  - Ranges are always "typically emerges…" — never deadlines, never "behind".
//  - A calm signpost appears only when the child's comparison age is more than
//    SIGNPOST_GRACE_MONTHS past the outer bound. We are not a screening tool.
import type { CatalogueEntry } from './catalogue';

export const SIGNPOST_TEXT =
  'Every child is different — if you have questions, your health visitor or GP is the right person to ask.';

const SIGNPOST_GRACE_MONTHS = 2;

export type MilestoneStatus =
  | { kind: 'achieved'; ageText: string }
  | { kind: 'range'; text: string }
  | { kind: 'range-with-signpost'; text: string; signpost: string };

/** 24 → "2 years", 30 → "2½ years". Bounds ≥24 are validated to be ÷6. */
function yearsText(months: number): string {
  const whole = Math.floor(months / 12);
  return months % 12 === 6 ? `${whole}½ years` : `${whole} years`;
}

export function rangeText(startMonths: number, endMonths: number): string {
  if (startMonths === 0) {
    return endMonths === 1
      ? 'Typically emerges in the first month'
      : `Typically emerges in the first ${endMonths} months`;
  }
  if (endMonths < 24) {
    return `Typically emerges between ${startMonths} and ${endMonths} months`;
  }
  if (startMonths >= 24) {
    // "between 2½ and 4 years" — drop the unit from the first bound.
    return `Typically emerges between ${yearsText(startMonths).replace(' years', '')} and ${yearsText(endMonths)}`;
  }
  return `Typically emerges between ${startMonths} months and ${yearsText(endMonths)}`;
}

export function milestoneStatus(
  entry: Pick<CatalogueEntry, 'typicalStartMonths' | 'typicalEndMonths' | 'skippable'>,
  comparisonMonths: number,
  achievedAgeText: string | null,
): MilestoneStatus {
  if (achievedAgeText !== null) {
    return { kind: 'achieved', ageText: achievedAgeText };
  }
  const text = rangeText(entry.typicalStartMonths, entry.typicalEndMonths);
  // Skippable milestones (many children healthily never do them) must never
  // trigger the signpost — that would be exactly the false alarm we avoid.
  if (!entry.skippable && comparisonMonths > entry.typicalEndMonths + SIGNPOST_GRACE_MONTHS) {
    return { kind: 'range-with-signpost', text, signpost: SIGNPOST_TEXT };
  }
  return { kind: 'range', text };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- rangePhrase
```

Expected: FAIL is acceptable ONLY if it is the missing `./catalogue` import — in that case create the catalogue type stub as Task 4 Step 3 defines the types, or reorder: implement Task 4 Steps 1–3 first. Simplest correct order: complete Task 4 Steps 1–3 (types + exemplar entries), then re-run this. When `catalogue.ts` exists: all rangePhrase tests pass.

- [ ] **Step 5: Commit** (may be combined with Task 4's commit if the type dependency forced interleaving — one commit for "range phrasing + catalogue schema" is acceptable; otherwise commit separately)

```bash
git add src/features/milestones/rangePhrase.ts src/features/milestones/__tests__/rangePhrase.test.ts
git commit -m "feat: milestone range phrasing — ranges, celebration, gentle signpost"
```

---

### Task 4: Catalogue schema, validation test, exemplar entries

The validation test is the contract that keeps the content honest: every entry must carry both bounds, sane ordering, celebratory copy, context, and ≥2 clinical sources from WHO/CDC/NHS domains.

**Files:**
- Create: `src/features/milestones/catalogue.ts`
- Test: `src/features/milestones/__tests__/catalogue.test.ts`

- [ ] **Step 1: Write the validation test**

Create `src/features/milestones/__tests__/catalogue.test.ts`:

```ts
import { CATALOGUE, CATEGORY_LABELS, celebrationText, MilestoneCategory } from '../catalogue';

// Task 4 ships 5 exemplar entries (one per category, two motor); Task 5
// raises this to the full 40.
const EXPECTED_MILESTONE_COUNT = 5;

const ALLOWED_SOURCE_HOSTS = ['who.int', 'cdc.gov', 'nhs.uk', 'nhsinform.scot'];

describe('milestone catalogue', () => {
  it('has the expected number of entries', () => {
    expect(CATALOGUE).toHaveLength(EXPECTED_MILESTONE_COUNT);
  });

  it('has unique, snake_case ids', () => {
    const ids = CATALOGUE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it.each(CATALOGUE.map((e) => [e.id, e] as const))('%s is fully specified', (_id, e) => {
    expect(e.title.trim().length).toBeGreaterThan(0);
    expect(e.verbPhrase.trim().length).toBeGreaterThan(0);
    expect(e.verbPhrase).toMatch(/^[a-z]/); // composes after "They just …"
    expect(e.context.trim().length).toBeGreaterThan(0);
    expect(Object.keys(CATEGORY_LABELS)).toContain(e.category);
    expect(e.typicalStartMonths).toBeGreaterThanOrEqual(0);
    expect(e.typicalEndMonths).toBeGreaterThan(e.typicalStartMonths);
    expect(e.typicalEndMonths).toBeLessThanOrEqual(72);
    for (const bound of [e.typicalStartMonths, e.typicalEndMonths]) {
      // Past 24 months, rangeText phrases bounds in (half-)years.
      if (bound >= 24) expect(bound % 6).toBe(0);
    }
    expect(e.sources.length).toBeGreaterThanOrEqual(2);
    for (const s of e.sources) {
      const host = new URL(s).hostname;
      expect(
        ALLOWED_SOURCE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)),
      ).toBe(true);
    }
  });

  it('never uses deadline or "behind" language in copy', () => {
    for (const e of CATALOGUE) {
      const copy = `${e.verbPhrase} ${e.context}`.toLowerCase();
      expect(copy).not.toMatch(/behind|should have|by now|late|delayed/);
    }
  });

  it('composes celebration copy from the verb phrase', () => {
    expect(celebrationText({ verbPhrase: 'rolled over' })).toBe('They just rolled over!');
  });

  it('covers every category', () => {
    const byCategory = new Map<MilestoneCategory, number>();
    for (const e of CATALOGUE) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + 1);
    }
    for (const category of Object.keys(CATEGORY_LABELS) as MilestoneCategory[]) {
      expect(byCategory.get(category) ?? 0).toBeGreaterThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- catalogue
```

Expected: FAIL — `Cannot find module '../catalogue'`.

- [ ] **Step 3: Implement `src/features/milestones/catalogue.ts` with the schema and 5 exemplars** (one per category so the coverage test holds from birth; two motor)

```ts
// The curated milestone catalogue (spec §5). App-bundled static data: it
// changes rarely, works offline, and needs no fetch. Every range was compiled
// from at least two of WHO / CDC "Learn the Signs. Act Early." / NHS guidance;
// the sources array records exactly which. The validation test in
// __tests__/catalogue.test.ts enforces structure so this file cannot rot.

export type MilestoneCategory = 'motor' | 'social' | 'language' | 'feeding';

export type CatalogueEntry = {
  /** Stable snake_case id — stored in moments.milestone_id, never rename. */
  id: string;
  title: string;
  /**
   * Lowercase verb phrase completing "They just …" — composed by
   * celebrationText() on capture and by Plan 3's share card
   * ("They just took their first steps at 13 months").
   */
  verbPhrase: string;
  category: MilestoneCategory;
  typicalStartMonths: number;
  typicalEndMonths: number;
  /** One reassuring sentence of context. Never deadline language. */
  context: string;
  /**
   * True for milestones many children healthily skip entirely (e.g. crawling):
   * suppresses the past-window signpost, which would otherwise false-alarm.
   */
  skippable?: boolean;
  /** ≥2 URLs, hosts limited to who.int / cdc.gov / nhs.uk / nhsinform.scot. */
  sources: string[];
};

export const CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  motor: 'Motor',
  social: 'Social',
  language: 'Language',
  feeding: 'Feeding & Self-care',
};

/** The canonical celebratory sentence: "They just rolled over!" */
export function celebrationText(entry: Pick<CatalogueEntry, 'verbPhrase'>): string {
  return `They just ${entry.verbPhrase}!`;
}

export const CATALOGUE: CatalogueEntry[] = [
  {
    id: 'rolled_over',
    title: 'Rolled over',
    verbPhrase: 'rolled over',
    category: 'motor',
    typicalStartMonths: 3,
    typicalEndMonths: 7,
    context: 'Rolling both ways takes practice — tummy time makes a big difference.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/milestones-6mo.html',
      'https://www.nhs.uk/conditions/baby/babys-development/height-weight-and-reviews/baby-reviews/',
    ],
  },
  {
    id: 'first_steps',
    title: 'First steps',
    verbPhrase: 'took their first steps',
    category: 'motor',
    typicalStartMonths: 8,
    typicalEndMonths: 18,
    context: 'Walking has one of the widest healthy windows of any milestone.',
    sources: [
      'https://www.who.int/publications/i/item/924154693X',
      'https://www.cdc.gov/act-early/milestones/milestones-18mo.html',
    ],
  },
  {
    id: 'first_smile',
    title: 'First smile',
    verbPhrase: 'smiled',
    category: 'social',
    typicalStartMonths: 0,
    typicalEndMonths: 3,
    context: 'That first real, social smile is usually aimed at a familiar face.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/milestones-2mo.html',
      'https://www.nhs.uk/conditions/baby/babys-development/height-weight-and-reviews/baby-reviews/',
    ],
  },
  {
    id: 'first_word',
    title: 'First word',
    verbPhrase: 'said their first word',
    category: 'language',
    typicalStartMonths: 10,
    typicalEndMonths: 15,
    context: 'First words often hide inside babble — "mama" and "dada" count.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/milestones-1yr.html',
      'https://www.nhs.uk/conditions/baby/babys-development/play-and-learning/helping-your-baby-to-talk/',
    ],
  },
  {
    id: 'used_spoon',
    title: 'Used a spoon',
    verbPhrase: 'used a spoon',
    category: 'feeding',
    typicalStartMonths: 12,
    typicalEndMonths: 20,
    context: 'Messy self-feeding is exactly how spoon skills are learned.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/milestones-18mo.html',
      'https://www.nhs.uk/start-for-life/baby/weaning/',
    ],
  },
];
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- catalogue && npm test -- rangePhrase
```

Expected: catalogue validation green (5 entries); rangePhrase green now that the type import resolves.

- [ ] **Step 5: Commit**

```bash
git add src/features/milestones/catalogue.ts src/features/milestones/__tests__/catalogue.test.ts
git commit -m "feat: milestone catalogue schema, validation contract, exemplar entries"
```

---

### Task 5: Compile the full 40-entry catalogue (research task)

This task is research + data entry, machine-checked by Task 4's validation test. For EVERY entry: consult at least two of WHO (Motor Development Study / child growth standards), CDC "Learn the Signs. Act Early." milestone pages (2022 revision), and NHS (nhs.uk baby development / Start for Life) via WebSearch/WebFetch; set the range to the span the sources jointly support (round outward to whole months, never narrower than any single consulted source); record the two-plus URLs actually consulted in `sources` (NHS inform Scotland, nhsinform.scot, counts as NHS — the national nhs.uk hub lacks per-milestone ages for several skills). Write celebration/context copy in the product voice: warm, no deadline language (the validation test rejects "behind|should have|by now|late|delayed").

**The fixed list — exactly these 40 ids (5 exemplars from Task 4 + 35 new):**

- **motor (13):** `rolled_over`✓, `sat_unsupported`, `crawled`, `pulled_to_stand`, `stood_unaided`, `first_steps`✓, `climbed_stairs`, `ran`, `kicked_ball`, `jumped`, `pincer_grip`, `stacked_blocks`, `scribbled`
- **social (9):** `first_smile`✓, `laughed`, `played_peekaboo`, `stranger_awareness`, `waved_bye`, `pointed_to_show`, `pretend_play`, `parallel_play`, `took_turns`
- **language (10):** `cooed`, `babbled`, `responded_to_name`, `first_word`✓, `understood_no`, `followed_instruction`, `two_word_phrase`, `named_body_part`, `fifty_words`, `said_own_name`
- **feeding (8):** `first_finger_food`, `drank_open_cup`, `used_spoon`✓, `fed_self_meal`, `used_fork`, `took_off_clothes`, `washed_hands`, `brushed_teeth_helped`

Additional authoring rules (from the Task 3/4 quality review):

- **Re-verify the five exemplars' ranges too**, not just the 35 new entries. In
  particular `first_smile`'s lower bound of 0 is suspect — the *social* smile is
  conventionally reported from ~6 weeks; adjust to what the sources support.
- **`skippable: true`** for any milestone the sources describe as commonly and
  healthily skipped — `crawled` at minimum (its context sentence must also say
  so). The signpost is suppressed for these.
- **verbPhrase style:** lowercase verb phrase completing "They just …"; for
  `first_*` milestones include "their first …" where it reads naturally
  ("said their first word"), plain past tense otherwise ("smiled").
- **Bounds ≥ 24 months must be divisible by 6** (the UI phrases them as whole
  or half years — the validation test enforces this).

**Files:**
- Modify: `src/features/milestones/catalogue.ts` (add 35 entries, keep category grouping order: motor, social, language, feeding)
- Modify: `src/features/milestones/__tests__/catalogue.test.ts` (one line: `EXPECTED_MILESTONE_COUNT = 5` → `40`)

- [ ] **Step 1: Bump the count to 40**

In `src/features/milestones/__tests__/catalogue.test.ts` change:

```ts
const EXPECTED_MILESTONE_COUNT = 40;
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- catalogue
```

Expected: FAIL — expected length 40, received 5.

- [ ] **Step 3: Research and add the 35 entries** following the exemplar format exactly (same field shapes, ≥2 sources each from the allowed hosts, ranges cross-checked as described above). Work category by category; keep the file ordered motor → social → language → feeding.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- catalogue
```

Expected: all validation tests pass at 40 entries.

- [ ] **Step 5: Full-suite sanity + commit**

```bash
npx tsc --noEmit && npm test
git add src/features/milestones/catalogue.ts src/features/milestones/__tests__/catalogue.test.ts
git commit -m "feat: full 40-milestone catalogue with WHO/CDC/NHS-sourced ranges"
```

---

### Task 6: Children data hooks (TDD on the logic)

**Files:**
- Create: `src/features/children/queries.ts`
- Test: `src/features/children/__tests__/queries.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/children/__tests__/queries.test.ts`:

```ts
import { createChild, ensureFamilyId, fetchChildren, updateChild } from '../queries';
import { supabase } from '../../../lib/supabase';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

const mockedRpc = supabase.rpc as jest.Mock;
const mockedFrom = supabase.from as jest.Mock;

afterEach(() => jest.clearAllMocks());

describe('ensureFamilyId', () => {
  it('returns the family id from the idempotent create_family RPC', async () => {
    mockedRpc.mockResolvedValue({ data: 'fam-1', error: null });
    await expect(ensureFamilyId()).resolves.toBe('fam-1');
    expect(mockedRpc).toHaveBeenCalledWith('create_family', { family_name: null });
  });

  it('throws on RPC error', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: new Error('nope') });
    await expect(ensureFamilyId()).rejects.toThrow('nope');
  });
});

describe('fetchChildren', () => {
  it('selects children ordered by creation', async () => {
    const order = jest.fn().mockResolvedValue({ data: [{ id: 'c1' }], error: null });
    mockedFrom.mockReturnValue({ select: () => ({ order }) });
    await expect(fetchChildren()).resolves.toEqual([{ id: 'c1' }]);
    expect(mockedFrom).toHaveBeenCalledWith('children');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
  });
});

describe('createChild', () => {
  it('ensures a family then inserts the child into it', async () => {
    mockedRpc.mockResolvedValue({ data: 'fam-1', error: null });
    const single = jest.fn().mockResolvedValue({ data: { id: 'c1' }, error: null });
    const insert = jest.fn().mockReturnValue({ select: () => ({ single }) });
    mockedFrom.mockReturnValue({ insert });

    const child = await createChild({ name: 'Aria', dateOfBirth: '2026-01-01', dueDate: null });

    expect(child).toEqual({ id: 'c1' });
    expect(insert).toHaveBeenCalledWith({
      family_id: 'fam-1',
      name: 'Aria',
      date_of_birth: '2026-01-01',
      due_date: null,
    });
  });
});

describe('updateChild', () => {
  it('updates the child by id with snake_case columns', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'c1' }, error: null });
    const eq = jest.fn().mockReturnValue({ select: () => ({ single }) });
    const update = jest.fn().mockReturnValue({ eq });
    mockedFrom.mockReturnValue({ update });

    const child = await updateChild('c1', {
      name: 'Aria',
      dateOfBirth: '2026-01-01',
      dueDate: '2026-03-01',
    });

    expect(child).toEqual({ id: 'c1' });
    expect(mockedFrom).toHaveBeenCalledWith('children');
    expect(update).toHaveBeenCalledWith({
      name: 'Aria',
      date_of_birth: '2026-01-01',
      due_date: '2026-03-01',
    });
    expect(eq).toHaveBeenCalledWith('id', 'c1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- queries
```

Expected: FAIL — `Cannot find module '../queries'`.

- [ ] **Step 3: Implement `src/features/children/queries.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export type Child = {
  id: string;
  family_id: string;
  name: string;
  date_of_birth: string;
  due_date: string | null;
};

export type ChildInput = {
  name: string;
  dateOfBirth: string;
  dueDate: string | null;
};

// create_family is idempotent (Plan 1): for any existing membership it returns
// that family; for a brand-new user it creates one. Either way: one call.
// The trap: an owner-only lookup would fork an invited co-parent (role
// 'parent', Plan 4) into a phantom family instead of their inviter's — the RPC
// returns the family of ANY existing membership, enforced at the DB level; see
// migration 20260716000003 and its pgTAP case.
export async function ensureFamilyId(): Promise<string> {
  const { data, error } = await supabase.rpc('create_family', { family_name: null });
  if (error) throw error;
  return data as string;
}

export async function fetchChildren(): Promise<Child[]> {
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Child[];
}

export async function createChild(input: ChildInput): Promise<Child> {
  const family_id = await ensureFamilyId();
  const { data, error } = await supabase
    .from('children')
    .insert({
      family_id,
      name: input.name,
      date_of_birth: input.dateOfBirth,
      due_date: input.dueDate,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Child;
}

export async function updateChild(id: string, input: ChildInput): Promise<Child> {
  const { data, error } = await supabase
    .from('children')
    .update({ name: input.name, date_of_birth: input.dateOfBirth, due_date: input.dueDate })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Child;
}

export function useChildren() {
  return useQuery({ queryKey: ['children'], queryFn: fetchChildren });
}

export function useCreateChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createChild,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['children'] }),
  });
}

export function useUpdateChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ChildInput }) => updateChild(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['children'] }),
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- queries && npx tsc --noEmit
```

Expected: 4 tests pass; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/children/queries.ts src/features/children/__tests__/queries.test.ts
git commit -m "feat: children data hooks over RLS-scoped tables via idempotent family bootstrap"
```

---

### Task 7: ChildForm component (TDD)

Dates are plain `YYYY-MM-DD` text inputs in this plan — a deliberate MVP choice (cross-platform, testable); native date pickers are a later polish item. Validation mirrors the DB constraints (`due_after_birth`) so users get friendly messages instead of Postgres errors.

**Files:**
- Create: `src/features/children/ChildForm.tsx`
- Test: `src/features/children/__tests__/ChildForm.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/children/__tests__/ChildForm.test.tsx`:

```tsx
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { ChildForm } from '../ChildForm';

// userEvent has no Switch interaction; fireEvent 'valueChange' is the
// documented way to drive RN Switch in RNTL.
function togglePremature(value: boolean) {
  fireEvent(screen.getByRole('switch'), 'valueChange', value);
}

describe('ChildForm', () => {
  it('submits a term child with a null due date', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(<ChildForm submitLabel="Add child" onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText('Name'), '  Aria ');
    await user.type(screen.getByPlaceholderText('Date of birth (YYYY-MM-DD)'), '2026-01-15');
    await user.press(screen.getByText('Add child'));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Aria',
      dateOfBirth: '2026-01-15',
      dueDate: null,
    });
  });

  it('reveals the due date field for premature children and submits it', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(<ChildForm submitLabel="Add child" onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText('Name'), 'Aria');
    await user.type(screen.getByPlaceholderText('Date of birth (YYYY-MM-DD)'), '2026-01-15');
    expect(screen.queryByPlaceholderText('Due date (YYYY-MM-DD)')).toBeNull();
    togglePremature(true);
    await user.type(screen.getByPlaceholderText('Due date (YYYY-MM-DD)'), '2026-03-20');
    await user.press(screen.getByText('Add child'));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Aria',
      dateOfBirth: '2026-01-15',
      dueDate: '2026-03-20',
    });
  });

  it('blocks an invalid date of birth', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(<ChildForm submitLabel="Add child" onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText('Name'), 'Aria');
    await user.type(screen.getByPlaceholderText('Date of birth (YYYY-MM-DD)'), '2026-02-30');
    await user.press(screen.getByText('Add child'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter the date of birth as YYYY-MM-DD')).toBeTruthy();
  });

  it('blocks a due date on or before the date of birth', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(<ChildForm submitLabel="Add child" onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText('Name'), 'Aria');
    await user.type(screen.getByPlaceholderText('Date of birth (YYYY-MM-DD)'), '2026-01-15');
    togglePremature(true);
    await user.type(screen.getByPlaceholderText('Due date (YYYY-MM-DD)'), '2026-01-10');
    await user.press(screen.getByText('Add child'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('The due date should be after the date of birth')).toBeTruthy();
  });

  it('shows a server error passed in', async () => {
    await render(<ChildForm submitLabel="Add child" onSubmit={jest.fn()} error="Network request failed" />);
    expect(screen.getByText('Network request failed')).toBeTruthy();
  });

  it('prefills initial values for editing', async () => {
    await render(
      <ChildForm
        submitLabel="Save"
        onSubmit={jest.fn()}
        initial={{ name: 'Aria', dateOfBirth: '2026-01-15', dueDate: '2026-03-20' }}
      />,
    );
    expect(screen.getByDisplayValue('Aria')).toBeTruthy();
    expect(screen.getByDisplayValue('2026-03-20')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- ChildForm
```

Expected: FAIL — `Cannot find module '../ChildForm'`.

- [ ] **Step 3: Implement `src/features/children/ChildForm.tsx`**

```tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { ChildInput } from './queries';

type Props = {
  submitLabel: string;
  onSubmit: (input: ChildInput) => void;
  initial?: ChildInput;
  /** Server-side failure (e.g. from useCreateChild().error) — AuthForm pattern. */
  error?: string | null;
  busy?: boolean;
};

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export function ChildForm({ submitLabel, onSubmit, initial, error, busy }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(initial?.dateOfBirth ?? '');
  const [premature, setPremature] = useState(initial?.dueDate != null);
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const handlePress = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setLocalError('Enter a name');
      return;
    }
    if (!isRealDate(dateOfBirth)) {
      setLocalError('Enter the date of birth as YYYY-MM-DD');
      return;
    }
    if (premature) {
      if (!isRealDate(dueDate)) {
        setLocalError('Enter the due date as YYYY-MM-DD');
        return;
      }
      if (dueDate <= dateOfBirth) {
        setLocalError('The due date should be after the date of birth');
        return;
      }
    }
    setLocalError(null);
    onSubmit({ name: trimmedName, dateOfBirth, dueDate: premature ? dueDate : null });
  };

  // Local validation is freshest — it must not be masked by a stale server error.
  const message = localError ?? error;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Name"
        accessibilityLabel="Name"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Date of birth (YYYY-MM-DD)"
        accessibilityLabel="Date of birth"
        autoCapitalize="none"
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Born before 37 weeks?</Text>
        <Switch value={premature} onValueChange={setPremature} accessibilityLabel="Born before 37 weeks" />
      </View>
      {premature ? (
        <TextInput
          style={styles.input}
          placeholder="Due date (YYYY-MM-DD)"
          accessibilityLabel="Due date"
          autoCapitalize="none"
          value={dueDate}
          onChangeText={setDueDate}
        />
      ) : null}
      {message ? (
        <Text style={styles.error} role="alert" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      <Pressable style={styles.button} onPress={handlePress} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? '…' : submitLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 16 },
  error: { color: '#b00020' },
  button: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- ChildForm
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/children/ChildForm.tsx src/features/children/__tests__/ChildForm.test.tsx
git commit -m "feat: child form with premature/due-date handling and friendly validation"
```

---

### Task 8: Achievements map + MilestoneRow (TDD)

**Files:**
- Create: `src/features/milestones/achievements.ts`
- Create: `src/features/milestones/MilestoneRow.tsx`
- Test: `src/features/milestones/__tests__/achievements.test.ts`
- Test: `src/features/milestones/__tests__/MilestoneRow.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/milestones/__tests__/achievements.test.ts`:

```ts
import { achievedAgeTexts } from '../achievements';

describe('achievedAgeTexts', () => {
  it('maps catalogue moments to formatted achievement ages', () => {
    const map = achievedAgeTexts(
      [
        { milestone_id: 'rolled_over', occurred_on: '2026-05-29' },
        { milestone_id: null, occurred_on: '2026-06-01' },
      ],
      '2026-01-15',
    );
    expect(map).toEqual({ rolled_over: '4 months, 2 weeks' });
  });

  it('keeps the earliest occurrence when duplicates exist', () => {
    const map = achievedAgeTexts(
      [
        { milestone_id: 'rolled_over', occurred_on: '2026-06-29' },
        { milestone_id: 'rolled_over', occurred_on: '2026-05-29' },
      ],
      '2026-01-15',
    );
    expect(map).toEqual({ rolled_over: '4 months, 2 weeks' });
  });
});
```

Create `src/features/milestones/__tests__/MilestoneRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { CATALOGUE } from '../catalogue';
import { MilestoneRow } from '../MilestoneRow';
import { SIGNPOST_TEXT } from '../rangePhrase';

const firstSteps = CATALOGUE.find((e) => e.id === 'first_steps')!;

describe('MilestoneRow', () => {
  it('renders an achieved milestone with a tick and age', async () => {
    await render(<MilestoneRow entry={firstSteps} comparisonMonths={14} achievedAgeText="13 months" />);
    expect(screen.getByText('✓ First steps')).toBeTruthy();
    expect(screen.getByText('At 13 months')).toBeTruthy();
  });

  it('renders the typical range when unachieved', async () => {
    await render(<MilestoneRow entry={firstSteps} comparisonMonths={5} achievedAgeText={null} />);
    expect(screen.getByText('First steps')).toBeTruthy();
    expect(screen.getByText('Typically emerges between 8 and 18 months')).toBeTruthy();
    expect(screen.queryByText(SIGNPOST_TEXT)).toBeNull();
  });

  it('renders the gentle signpost well past the window', async () => {
    await render(<MilestoneRow entry={firstSteps} comparisonMonths={21} achievedAgeText={null} />);
    expect(screen.getByText(SIGNPOST_TEXT)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- achievements && npm test -- MilestoneRow
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/features/milestones/achievements.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { ageParts, formatAgeParts } from '../children/age';
import { supabase } from '../../lib/supabase';

export type MomentSummary = { milestone_id: string | null; occurred_on: string };

// ALWAYS filter moments by child_id: RLS is a per-row post-filter, and an
// unfiltered select would scan every family's rows (Plan 1 guardrail).
export async function fetchMomentSummaries(childId: string): Promise<MomentSummary[]> {
  const { data, error } = await supabase
    .from('moments')
    .select('milestone_id, occurred_on')
    .eq('child_id', childId);
  if (error) throw error;
  return (data ?? []) as MomentSummary[];
}

export function useMomentSummaries(childId: string | null) {
  return useQuery({
    queryKey: ['moments', childId],
    queryFn: () => fetchMomentSummaries(childId as string),
    enabled: childId !== null,
  });
}

/** milestone_id → "4 months, 2 weeks" (age at the earliest matching moment). */
export function achievedAgeTexts(
  moments: MomentSummary[],
  dateOfBirth: string,
): Record<string, string> {
  const earliest: Record<string, string> = {};
  for (const m of moments) {
    if (m.milestone_id === null) continue;
    const existing = earliest[m.milestone_id];
    if (existing === undefined || m.occurred_on < existing) {
      earliest[m.milestone_id] = m.occurred_on;
    }
  }
  const out: Record<string, string> = {};
  for (const [id, occurredOn] of Object.entries(earliest)) {
    out[id] = formatAgeParts(ageParts(dateOfBirth, occurredOn));
  }
  return out;
}
```

- [ ] **Step 4: Implement `src/features/milestones/MilestoneRow.tsx`**

```tsx
import { StyleSheet, Text, View } from 'react-native';
import type { CatalogueEntry } from './catalogue';
import { milestoneStatus } from './rangePhrase';

type Props = {
  entry: CatalogueEntry;
  comparisonMonths: number;
  achievedAgeText: string | null;
};

export function MilestoneRow({ entry, comparisonMonths, achievedAgeText }: Props) {
  const status = milestoneStatus(entry, comparisonMonths, achievedAgeText);

  if (status.kind === 'achieved') {
    return (
      <View style={styles.row}>
        <Text style={styles.titleAchieved}>{`✓ ${entry.title}`}</Text>
        <Text style={styles.subtitle}>{`At ${status.ageText}`}</Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.title}>{entry.title}</Text>
      <Text style={styles.subtitle}>{status.text}</Text>
      {status.kind === 'range-with-signpost' ? (
        <Text style={styles.signpost}>{status.signpost}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    gap: 2,
  },
  title: { fontSize: 16, fontWeight: '600' },
  titleAchieved: { fontSize: 16, fontWeight: '600', color: '#1a7f37' },
  subtitle: { fontSize: 14, color: '#555' },
  signpost: { fontSize: 13, color: '#777', fontStyle: 'italic', marginTop: 4 },
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- achievements && npm test -- MilestoneRow && npx tsc --noEmit
```

Expected: 5 tests pass; tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/features/milestones/achievements.ts src/features/milestones/MilestoneRow.tsx src/features/milestones/__tests__/achievements.test.ts src/features/milestones/__tests__/MilestoneRow.test.tsx
git commit -m "feat: achievement mapping and milestone row presentation"
```

---

### Task 9: Selected-child context, tab shell, Family and Milestones screens

UI composition — the pieces are all tested; the screens compose them and are verified at runtime (Task 10). Keep the code exactly as below.

**Files:**
- Create: `src/features/children/selectedChild.tsx`
- Modify: `src/app/(app)/_layout.tsx` (Stack → Tabs + provider)
- Modify: `src/app/(app)/index.tsx` (redirect)
- Create: `src/app/(app)/milestones.tsx`
- Create: `src/app/(app)/family.tsx`

- [ ] **Step 1: Create `src/features/children/selectedChild.tsx`**

```tsx
import { createContext, ReactNode, useContext, useState } from 'react';
import type { Child } from './queries';
import { useChildren } from './queries';

type SelectedChildValue = {
  children: Child[];
  selected: Child | null;
  select: (id: string) => void;
  loading: boolean;
};

const SelectedChildContext = createContext<SelectedChildValue | null>(null);

export function SelectedChildProvider({ children: node }: { children: ReactNode }) {
  const { data = [], isPending } = useChildren();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data.find((c) => c.id === selectedId) ?? data[0] ?? null;

  return (
    <SelectedChildContext.Provider
      value={{ children: data, selected, select: setSelectedId, loading: isPending }}
    >
      {node}
    </SelectedChildContext.Provider>
  );
}

export function useSelectedChild(): SelectedChildValue {
  const value = useContext(SelectedChildContext);
  if (!value) throw new Error('useSelectedChild must be used inside SelectedChildProvider');
  return value;
}
```

- [ ] **Step 2: Replace `src/app/(app)/_layout.tsx`**

```tsx
import { Tabs } from 'expo-router';
import { SelectedChildProvider } from '@/features/children/selectedChild';

export default function AppLayout() {
  return (
    <SelectedChildProvider>
      <Tabs>
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="milestones" options={{ title: 'Milestones' }} />
        <Tabs.Screen name="family" options={{ title: 'Family' }} />
      </Tabs>
    </SelectedChildProvider>
  );
}
```

- [ ] **Step 3: Replace `src/app/(app)/index.tsx`**

```tsx
import { Redirect } from 'expo-router';

export default function AppIndex() {
  return <Redirect href="/milestones" />;
}
```

- [ ] **Step 4: Create `src/app/(app)/milestones.tsx`**

```tsx
import { Link } from 'expo-router';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { childAge, formatChildAge } from '@/features/children/age';
import { useSelectedChild } from '@/features/children/selectedChild';
import { achievedAgeTexts, useMomentSummaries } from '@/features/milestones/achievements';
import { CATALOGUE, CATEGORY_LABELS, MilestoneCategory } from '@/features/milestones/catalogue';
import { MilestoneRow } from '@/features/milestones/MilestoneRow';

export default function MilestonesScreen() {
  const { children, selected, select, loading } = useSelectedChild();
  const { data: moments = [] } = useMomentSummaries(selected?.id ?? null);

  if (loading) return null;

  if (!selected) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Who are we celebrating?</Text>
        <Text style={styles.emptyBody}>Add your child to see their milestones.</Text>
        <Link href="/family" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Add your child</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  const age = childAge(selected.date_of_birth, selected.due_date, new Date());
  const achieved = achievedAgeTexts(moments, selected.date_of_birth);
  const sections = (Object.keys(CATEGORY_LABELS) as MilestoneCategory[]).map((category) => ({
    title: CATEGORY_LABELS[category],
    data: CATALOGUE.filter((e) => e.category === category),
  }));

  return (
    <SectionList
      sections={sections}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={
        <View style={styles.header}>
          {children.length > 1 ? (
            <View style={styles.switcher}>
              {children.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => select(c.id)}
                  style={[styles.chip, c.id === selected.id && styles.chipSelected]}
                >
                  <Text style={c.id === selected.id ? styles.chipTextSelected : styles.chipText}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={styles.childName}>{selected.name}</Text>
          <Text style={styles.childAge}>{formatChildAge(age)}</Text>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <MilestoneRow
          entry={item}
          comparisonMonths={age.comparisonMonths}
          achievedAgeText={achieved[item.id] ?? null}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 8 },
  emptyTitle: { fontSize: 22, fontWeight: '700' },
  emptyBody: { fontSize: 15, color: '#555', marginBottom: 12 },
  button: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  header: { padding: 16, gap: 4 },
  switcher: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: '#1a1a2e',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  chipSelected: { backgroundColor: '#1a1a2e' },
  chipText: { color: '#1a1a2e' },
  chipTextSelected: { color: 'white' },
  childName: { fontSize: 24, fontWeight: '800' },
  childAge: { fontSize: 15, color: '#555' },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#888',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
});
```

- [ ] **Step 5: Create `src/app/(app)/family.tsx`**

```tsx
import { useState } from 'react';
import { Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { childAge, formatChildAge } from '@/features/children/age';
import { ChildForm } from '@/features/children/ChildForm';
import { useChildren, useCreateChild, useUpdateChild } from '@/features/children/queries';
import { supabase } from '@/lib/supabase';

export default function FamilyScreen() {
  const { data: children = [] } = useChildren();
  const createChild = useCreateChild();
  const updateChild = useUpdateChild();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const editing = children.find((c) => c.id === editingId) ?? null;

  return (
    <FlatList
      data={children}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={<Text style={styles.heading}>Your family</Text>}
      renderItem={({ item }) => (
        <View style={styles.childRow}>
          <View style={styles.childInfo}>
            <Text style={styles.childName}>{item.name}</Text>
            <Text style={styles.childAge}>
              {formatChildAge(childAge(item.date_of_birth, item.due_date, new Date()))}
            </Text>
          </View>
          <Button title="Edit" onPress={() => setEditingId(item.id)} />
        </View>
      )}
      ListFooterComponent={
        <View style={styles.footer}>
          {editing ? (
            <View style={styles.form}>
              <Text style={styles.formTitle}>{`Edit ${editing.name}`}</Text>
              <ChildForm
                submitLabel="Save"
                busy={updateChild.isPending}
                error={updateChild.error?.message ?? null}
                initial={{
                  name: editing.name,
                  dateOfBirth: editing.date_of_birth,
                  dueDate: editing.due_date,
                }}
                onSubmit={(input) =>
                  updateChild.mutate(
                    { id: editing.id, input },
                    { onSuccess: () => setEditingId(null) },
                  )
                }
              />
              <Button title="Cancel" onPress={() => setEditingId(null)} />
            </View>
          ) : adding || children.length === 0 ? (
            <View style={styles.form}>
              <Text style={styles.formTitle}>Add a child</Text>
              <ChildForm
                submitLabel="Add child"
                busy={createChild.isPending}
                error={createChild.error?.message ?? null}
                onSubmit={(input) => createChild.mutate(input, { onSuccess: () => setAdding(false) })}
              />
              {children.length > 0 ? (
                <Button title="Cancel" onPress={() => setAdding(false)} />
              ) : null}
            </View>
          ) : (
            <Button title="Add another child" onPress={() => setAdding(true)} />
          )}
          <View style={styles.signOut}>
            <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800', padding: 16 },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  childInfo: { gap: 2 },
  childName: { fontSize: 17, fontWeight: '600' },
  childAge: { fontSize: 14, color: '#555' },
  footer: { padding: 16, gap: 16 },
  form: { gap: 12 },
  formTitle: { fontSize: 18, fontWeight: '700' },
  signOut: { marginTop: 24 },
});
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit && npm test
```

Expected: tsc exit 0; full suite green (7 pre-existing + all new = 41 tests across 9 suites).

- [ ] **Step 7: Commit**

```bash
git add src/features/children/selectedChild.tsx "src/app/(app)/_layout.tsx" "src/app/(app)/index.tsx" "src/app/(app)/milestones.tsx" "src/app/(app)/family.tsx"
git commit -m "feat: tab shell, family screen with child CRUD, milestones screen"
```

---

### Task 10: Full verification and handoff to runtime check

**Files:** none new.

- [ ] **Step 1: Full local gates**

```bash
npx tsc --noEmit && npm test && supabase test db
```

Expected: tsc exit 0; all Jest suites green; pgTAP still Files=3, Tests=44, PASS (nothing in this plan touches the DB).

- [ ] **Step 2: Web export smoke check**

```bash
npx expo export --platform web 2>&1 | tail -3 && rm -rf dist
```

Expected: exit 0.

- [ ] **Step 3: Report DONE.** The coordinator performs the runtime verification in a browser against local Supabase (sign in → Family tab → add a term child and a premature child → Milestones tab: catalogue grouped by category, ranges phrased, corrected age shown for the premature child, child switcher works), then merges via the finishing flow.

---

## Self-review (done at writing time)

- **Spec coverage:** §3 data model (children incl. due_date) → Tasks 6–7; §4 Milestones screen + child switcher + empty-state onboarding prompt → Task 9; §4 Family & settings (children add/edit) → Task 9; §5 catalogue with ranges/sources/copy rules → Tasks 4–5; §5 corrected age incl. 24-month cutoff and dual display → Task 2; §5 signpost rule (>2 months past outer bound) → Task 3. Capture flow, share cards, timeline are Plan 3 by design. Sign-out moved to Family (old placeholder home is replaced).
- **Placeholders:** none — Task 5 is a bounded research procedure with a fixed 40-id list, exemplar format, machine-checked output, and explicit sourcing rules; all other steps carry complete code.
- **Type consistency:** `CatalogueEntry`/`CATEGORY_LABELS` (Task 4) match usage in Tasks 3, 8, 9; `ChildInput`/`Child` (Task 6) match ChildForm (Task 7) and screens (Task 9); `childAge`/`formatChildAge`/`formatAgeParts`/`ageParts` signatures consistent across Tasks 2, 8, 9; `useMomentSummaries`/`achievedAgeTexts` (Task 8) match Task 9's usage; `milestoneStatus` (Task 3) matches MilestoneRow (Task 8).
