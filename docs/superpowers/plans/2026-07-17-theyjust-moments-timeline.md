# TheyJust Moments & Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A parent can capture a moment (a milestone or a custom "first", with a date, a note, and an optional photo), see it land instantly in a per-child Timeline, open it to edit or delete, and share a rendered keepsake card.

**Architecture:** Moments already have their table + RLS from Plan 1; this plan adds the Storage bucket (private, family-scoped RLS) for photo files, a moments data layer over TanStack Query with optimistic create, a photo pipeline (pick → resize → upload → row), and four UI surfaces (Timeline home, capture modal, moment detail, share card). Photos are optional — a text-only moment is a first-class moment. Optimistic create makes a moment appear in the Timeline immediately; photo upload runs after the row exists with per-photo retry. (A queue that survives full app restart, spec §7, is deliberately deferred — the moment row is the memory and is saved first; a failed photo shows tap-to-retry.)

**Tech Stack:** Existing Expo SDK 57 + TS + jest-expo + Supabase + TanStack Query, plus `expo-image-picker` (camera/library; web falls back to the browser file input), `expo-image-manipulator` (resize/compress), `expo-file-system`, `react-native-view-shot` (render the share card to an image), `expo-sharing`.

**This is Plan 3 of 4.** Spec: `docs/superpowers/specs/2026-07-16-theyjust-milestone-tracker-design.md` §4 (screens), §7 (offline/optimistic). Plan 1 gave the schema/RLS; Plan 2 gave children, the 40-milestone catalogue, `celebrationText()`, `childAge`/`formatAgeParts`, the Milestones + Family screens, and the hardback design system (DESIGN.md, `src/theme/tokens.ts`, `src/components/{Field,PrimaryButton,TextButton}`). Plan 4 adds co-parent invites (and with them, display names — until then the Timeline shows "You" vs "A co-parent" from `logged_by`), export, deletion, social sign-in.

**Conventions (from Plans 1–2):**
- Plan code blocks are kept byte-identical to shipped files; implementers verify with scripted diffs. When reality beats the plan (an API differs), fix the code first, report the final file, and the coordinator syncs the plan.
- TDD for pure logic and components; STOP and report if a plan test contradicts a plan implementation.
- Stage only the task's own files (never `git add -A`); reviewers are strictly read-only (never `npm run lint`).
- Source under `src/features/`/`src/components/` uses relative imports; only `src/app/` uses the `@/` alias.
- The design system is settled: use `color`/`font`/`type`/`space`/`radius`/`hairline` from `src/theme/tokens.ts`, `Field`/`PrimaryButton`/`TextButton` from `src/components/`, Fraunces for the celebration voice only. No em dashes in user-facing copy.
- Work on branch `moments-timeline` (already created off `main`).
- Jest starts at 102 tests / 10 suites; pgTAP at 3 files / 46 assertions.

**File structure (all new unless noted):**

```
supabase/migrations/20260717000001_storage.sql       moment-photos bucket + family-scoped RLS
supabase/tests/0004_storage.test.sql                 pgTAP: only family members reach a moment's photos
src/features/moments/momentText.ts                   momentTitle() (celebration | custom), pure
src/features/moments/__tests__/momentText.test.ts
src/features/moments/momentQueries.ts                timeline fetch + create/update/delete + hooks
src/features/moments/__tests__/momentQueries.test.ts
src/features/moments/photoPath.ts                    storage path builder + resize params, pure
src/features/moments/__tests__/photoPath.test.ts
src/features/moments/photoUpload.ts                  pick/resize/upload/signed-url (native-wrapping)
src/features/moments/MomentCard.tsx                  a Timeline card
src/features/moments/__tests__/MomentCard.test.tsx
src/features/moments/CaptureForm.tsx                 title/date/note/photos capture form
src/features/moments/__tests__/CaptureForm.test.tsx
src/features/moments/ShareCard.tsx                   off-screen keepsake card (rendered to image)
src/features/moments/shareMoment.ts                  capture ShareCard → share sheet
src/app/(app)/_layout.tsx                            MODIFY: Timeline tab first, then Milestones, Family
src/app/(app)/index.tsx                              MODIFY: redirect → the Timeline home screen
src/app/(app)/capture.tsx                            capture modal screen
src/app/(app)/moment/[id].tsx                        moment detail screen
src/app/(app)/milestones.tsx                         MODIFY: tap an unachieved row → capture prefilled
```

**Prerequisite:** Docker running, local Supabase up (`supabase status`).

---

### Task 1: Storage bucket + family-scoped RLS (TDD with pgTAP), media deps

Photo files live in a private Storage bucket. A user may read/write an object only if they belong to the family that owns the moment. We encode the object path as `{moment_id}/{filename}` and check membership by looking the moment up through `can_access_moment` (the Plan 1 helper).

**Files:**
- Create: `supabase/migrations/20260717000001_storage.sql`
- Create: `supabase/tests/0004_storage.test.sql`
- Modify: `package.json` (+ lockfile, via install)

- [ ] **Step 1: Install media dependencies**

```bash
npx expo install expo-image-picker expo-image-manipulator expo-file-system react-native-view-shot expo-sharing
npx expo install --check
```

Expected: install succeeds; `--check` reports dependencies up to date.

- [ ] **Step 2: Write the failing storage-policy test**

Create `supabase/tests/0004_storage.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select has_table('storage', 'objects', 'storage.objects exists');
select has_function(
  'public', 'can_access_moment', array['uuid'],
  'can_access_moment helper is present (from Plan 1)');

-- Seed: two families, a child + moment in Alice's family, and a storage object
-- for that moment. (superuser bypasses RLS for seeding.)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'bob@test.local');
insert into public.families (id, name, created_by) values
  ('00000000-0000-0000-0000-0000000000fa', 'Alice family', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000fb', 'Bob family',   '00000000-0000-0000-0000-0000000000b1');
insert into public.family_members (family_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-0000000000fb', '00000000-0000-0000-0000-0000000000b1', 'owner');
insert into public.children (id, family_id, name, date_of_birth) values
  ('00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-0000000000fa', 'Alice Jr', '2026-01-01');
insert into public.moments (id, child_id, milestone_id, occurred_on, logged_by) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000ca',
   'first_smile', '2026-03-01', '00000000-0000-0000-0000-0000000000a1');
insert into storage.buckets (id, name, public) values ('moment-photos', 'moment-photos', false)
  on conflict (id) do nothing;
insert into storage.objects (bucket_id, name, owner)
  values ('moment-photos', '00000000-0000-0000-0000-0000000000d1/p1.jpg',
          '00000000-0000-0000-0000-0000000000a1');
-- A malformed-path object (first segment is not a uuid): the policy must DENY
-- it without erroring, so it can never break RLS for the whole bucket. Because
-- the assertions below query storage.objects, an unguarded ::uuid cast would
-- make them ERROR rather than return a count — this row is the guard.
insert into storage.objects (bucket_id, name, owner)
  values ('moment-photos', 'not-a-uuid/junk.jpg', '00000000-0000-0000-0000-0000000000a1');

-- As Bob (not in Alice's family): neither object is visible.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}', true);
select is(
  (select count(*) from storage.objects where bucket_id = 'moment-photos'),
  0::bigint,
  'Bob cannot see a photo object belonging to Alice''s moment');

-- As Alice: exactly her one valid object (the malformed one is denied, not errored).
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select is(
  (select count(*) from storage.objects where bucket_id = 'moment-photos'),
  1::bigint,
  'Alice sees her valid object; the malformed-path object neither errors nor shows');

-- Write gate: Alice may upload under her own moment; Bob may not.
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('moment-photos', '00000000-0000-0000-0000-0000000000d1/p2.jpg',
            '00000000-0000-0000-0000-0000000000a1')$$,
  'Alice can upload under her own moment');

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('moment-photos', '00000000-0000-0000-0000-0000000000d1/evil.jpg',
            '00000000-0000-0000-0000-0000000000b1')$$,
  '42501', null,
  'Bob cannot upload under Alice''s moment');

select * from finish();
rollback;
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
supabase db reset && supabase test db
```

Expected: FAIL — the moment-photos bucket policies don't exist yet, so RLS on `storage.objects` (enabled by default) hides the row from both roles: the "Alice can see" assertion fails (count 0, not 1).

- [ ] **Step 4: Write the storage migration**

Create `supabase/migrations/20260717000001_storage.sql`:

```sql
-- Private bucket for moment photos. Access is decided per object by the moment
-- the object's first path segment names, reusing the Plan 1 membership helper.
insert into storage.buckets (id, name, public)
values ('moment-photos', 'moment-photos', false)
on conflict (id) do nothing;

-- Safely pull the moment id out of an object path "{moment_id}/{filename}".
-- Returns null (which can_access_moment treats as "deny") rather than raising
-- when the first segment is missing or not a uuid — so one malformed object can
-- never turn the whole bucket's RLS into a statement error for every user.
create or replace function public.moment_photo_moment_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  seg text := (storage.foldername(object_name))[1];
begin
  return seg::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create policy moment_photos_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'moment-photos'
    and public.can_access_moment(public.moment_photo_moment_id(name))
  );

create policy moment_photos_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'moment-photos'
    and public.can_access_moment(public.moment_photo_moment_id(name))
  );

-- Update policy lets a legitimate upsert retry succeed (same predicate, fails
-- closed for non-members) instead of a confusing 403 on re-upload.
create policy moment_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'moment-photos'
    and public.can_access_moment(public.moment_photo_moment_id(name))
  );

create policy moment_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'moment-photos'
    and public.can_access_moment(public.moment_photo_moment_id(name))
  );
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
supabase db reset && supabase test db
```

Expected: all pass — 4 files / 52 assertions total (46 + 6).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260717000001_storage.sql supabase/tests/0004_storage.test.sql package.json package-lock.json app.json
git commit -m "feat: private moment-photos storage bucket with family-scoped RLS (pgTAP-tested)"
```

(`app.json` is included because `expo install expo-sharing` auto-registers its
config plugin there — a required native-build artifact of Step 1.)

---

### Task 2: Moment title composition (TDD)

A moment's display title is either its milestone's celebration ("They just rolled over!") or its custom title verbatim. One pure function, so the Timeline card and detail screen never re-derive it.

**Files:**
- Create: `src/features/moments/momentText.ts`
- Test: `src/features/moments/__tests__/momentText.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/moments/__tests__/momentText.test.ts`:

```ts
import { momentTitle } from '../momentText';

describe('momentTitle', () => {
  it('uses the milestone celebration for a catalogue moment', () => {
    expect(momentTitle({ milestone_id: 'rolled_over', custom_title: null })).toBe(
      'They just rolled over!',
    );
  });

  it('uses the custom title verbatim for a custom moment', () => {
    expect(momentTitle({ milestone_id: null, custom_title: 'First haircut' })).toBe(
      'First haircut',
    );
  });

  it('falls back gracefully if a milestone id is unknown', () => {
    expect(momentTitle({ milestone_id: 'not_a_real_id', custom_title: null })).toBe(
      'A new milestone',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- momentText
```

Expected: FAIL — `Cannot find module '../momentText'`.

- [ ] **Step 3: Implement `src/features/moments/momentText.ts`**

```ts
import { CATALOGUE, celebrationText } from '../milestones/catalogue';

type TitleInput = { milestone_id: string | null; custom_title: string | null };

// A moment is a catalogue milestone (celebration voice) XOR a custom title
// (verbatim). The unknown-id fallback should never fire for shipped data, but
// keeps a renamed/removed catalogue entry from showing a blank card.
export function momentTitle({ milestone_id, custom_title }: TitleInput): string {
  if (custom_title != null) return custom_title;
  const entry = CATALOGUE.find((e) => e.id === milestone_id);
  return entry ? celebrationText(entry) : 'A new milestone';
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- momentText
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/features/moments/momentText.ts src/features/moments/__tests__/momentText.test.ts
git commit -m "feat: moment title composition (celebration or custom)"
```

---

### Task 3: Photo path + resize params (TDD)

Pure helpers the photo pipeline leans on: the storage object path for a moment's photo, and the resize target. Isolated so they're testable without the native picker.

**Files:**
- Create: `src/features/moments/photoPath.ts`
- Test: `src/features/moments/__tests__/photoPath.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/moments/__tests__/photoPath.test.ts`:

```ts
import { RESIZE, photoObjectPath } from '../photoPath';

describe('photoObjectPath', () => {
  it('namespaces by moment id so storage RLS can find the moment', () => {
    expect(photoObjectPath('mom-1', 'photo-abc')).toBe('mom-1/photo-abc.jpg');
  });
});

describe('RESIZE', () => {
  it('caps the long edge and compresses (keeps files small, storage cheap)', () => {
    expect(RESIZE.maxDimension).toBe(2048);
    expect(RESIZE.compress).toBeGreaterThan(0);
    expect(RESIZE.compress).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- photoPath
```

Expected: FAIL — `Cannot find module '../photoPath'`.

- [ ] **Step 3: Implement `src/features/moments/photoPath.ts`**

```ts
// The object path's first segment MUST be the moment id: the storage RLS policy
// (migration 20260717000001) reads it back with storage.foldername(name)[1] to
// find the moment and check family membership.
export function photoObjectPath(momentId: string, photoId: string): string {
  return `${momentId}/${photoId}.jpg`;
}

// Client-side resize before upload: cap the long edge and re-encode as JPEG so
// a phone camera's multi-MB original becomes a lean, storage-cheap file.
export const RESIZE = {
  maxDimension: 2048,
  compress: 0.8,
} as const;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- photoPath
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/features/moments/photoPath.ts src/features/moments/__tests__/photoPath.test.ts
git commit -m "feat: photo storage path + resize params"
```

---

### Task 4: Moment data layer (TDD on the logic)

Timeline fetch (moments + their photos for a child, newest first), and create/update/delete with a TanStack Query optimistic create so a new moment appears instantly.

**Files:**
- Create: `src/features/moments/momentQueries.ts`
- Test: `src/features/moments/__tests__/momentQueries.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/moments/__tests__/momentQueries.test.ts`:

```ts
import { createMoment, deleteMoment, fetchTimeline, updateMoment } from '../momentQueries';
import { supabase } from '../../../lib/supabase';

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));

const mockedFrom = supabase.from as jest.Mock;
const mockedGetUser = supabase.auth.getUser as jest.Mock;

afterEach(() => jest.clearAllMocks());

describe('fetchTimeline', () => {
  it('selects a child\'s moments with photos, newest first', async () => {
    const order = jest.fn().mockResolvedValue({ data: [{ id: 'm1', moment_photos: [] }], error: null });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    mockedFrom.mockReturnValue({ select });

    await expect(fetchTimeline('child-1')).resolves.toEqual([{ id: 'm1', moment_photos: [] }]);
    expect(mockedFrom).toHaveBeenCalledWith('moments');
    expect(select).toHaveBeenCalledWith('*, moment_photos(*)');
    expect(eq).toHaveBeenCalledWith('child_id', 'child-1');
    expect(order).toHaveBeenCalledWith('occurred_on', { ascending: false });
  });
});

describe('createMoment', () => {
  it('stamps logged_by from the signed-in user and inserts', async () => {
    mockedGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    const single = jest.fn().mockResolvedValue({ data: { id: 'm1' }, error: null });
    const insert = jest.fn().mockReturnValue({ select: () => ({ single }) });
    mockedFrom.mockReturnValue({ insert });

    const moment = await createMoment({
      childId: 'child-1',
      milestoneId: 'rolled_over',
      customTitle: null,
      occurredOn: '2026-05-01',
      note: 'flipped right over',
    });

    expect(moment).toEqual({ id: 'm1' });
    expect(insert).toHaveBeenCalledWith({
      child_id: 'child-1',
      milestone_id: 'rolled_over',
      custom_title: null,
      occurred_on: '2026-05-01',
      note: 'flipped right over',
      logged_by: 'user-1',
    });
  });

  it('throws if there is no signed-in user', async () => {
    mockedGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(
      createMoment({ childId: 'c', milestoneId: 'x', customTitle: null, occurredOn: '2026-01-01', note: '' }),
    ).rejects.toThrow('Not signed in');
  });
});

describe('updateMoment', () => {
  it('updates only the editable columns', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'm1' }, error: null });
    const eq = jest.fn().mockReturnValue({ select: () => ({ single }) });
    const update = jest.fn().mockReturnValue({ eq });
    mockedFrom.mockReturnValue({ update });

    await updateMoment('m1', { occurredOn: '2026-05-02', note: 'edited' });
    expect(update).toHaveBeenCalledWith({ occurred_on: '2026-05-02', note: 'edited' });
    expect(eq).toHaveBeenCalledWith('id', 'm1');
  });
});

describe('deleteMoment', () => {
  it('deletes by id', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq });
    mockedFrom.mockReturnValue({ delete: del });

    await deleteMoment('m1');
    expect(mockedFrom).toHaveBeenCalledWith('moments');
    expect(eq).toHaveBeenCalledWith('id', 'm1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- momentQueries
```

Expected: FAIL — `Cannot find module '../momentQueries'`.

- [ ] **Step 3: Implement `src/features/moments/momentQueries.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export type MomentPhoto = {
  id: string;
  moment_id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  position: number;
};

export type Moment = {
  id: string;
  child_id: string;
  milestone_id: string | null;
  custom_title: string | null;
  occurred_on: string;
  note: string | null;
  logged_by: string | null;
  created_at: string;
  moment_photos: MomentPhoto[];
};

export type NewMoment = {
  childId: string;
  milestoneId: string | null;
  customTitle: string | null;
  occurredOn: string;
  note: string;
};

export type MomentEdit = { occurredOn: string; note: string };

// ALWAYS filter by child_id: RLS is a per-row post-filter, so an unfiltered
// select would scan every family's moments (Plan 1 guardrail).
export async function fetchTimeline(childId: string): Promise<Moment[]> {
  const { data, error } = await supabase
    .from('moments')
    .select('*, moment_photos(*)')
    .eq('child_id', childId)
    .order('occurred_on', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Moment[];
}

export async function createMoment(input: NewMoment): Promise<Moment> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('moments')
    .insert({
      child_id: input.childId,
      milestone_id: input.milestoneId,
      custom_title: input.customTitle,
      occurred_on: input.occurredOn,
      note: input.note,
      logged_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Moment;
}

// occurred_on + note are the only fields a moment edit touches; milestone_id,
// child_id, and logged_by are locked at the grant layer (Plan 1).
export async function updateMoment(id: string, edit: MomentEdit): Promise<Moment> {
  const { data, error } = await supabase
    .from('moments')
    .update({ occurred_on: edit.occurredOn, note: edit.note })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Moment;
}

export async function deleteMoment(id: string): Promise<void> {
  const { error } = await supabase.from('moments').delete().eq('id', id);
  if (error) throw error;
}

export function useTimeline(childId: string | null) {
  return useQuery({
    queryKey: ['timeline', childId],
    queryFn: () => fetchTimeline(childId as string),
    enabled: childId !== null,
  });
}

export function useCreateMoment(childId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMoment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeline', childId] }),
  });
}

export function useUpdateMoment(childId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, edit }: { id: string; edit: MomentEdit }) => updateMoment(id, edit),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeline', childId] }),
  });
}

export function useDeleteMoment(childId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMoment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeline', childId] }),
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- momentQueries && npx tsc --noEmit
```

Expected: 5 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/moments/momentQueries.ts src/features/moments/__tests__/momentQueries.test.ts
git commit -m "feat: moment data layer — timeline fetch, create/update/delete, hooks"
```

---

### Task 5: Photo pipeline (native-wrapping module, thin)

Wraps the native modules: pick from camera/library, resize, upload to Storage, insert the `moment_photos` row, and mint a signed URL to display. Kept thin (no branching logic worth unit-testing beyond Task 3's pure helpers, which it reuses); verified at runtime in Task 12.

**Files:**
- Create: `src/features/moments/photoUpload.ts`

- [ ] **Step 1: Implement `src/features/moments/photoUpload.ts`**

```ts
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { RESIZE, photoObjectPath } from './photoPath';

export type PickedPhoto = { uri: string; width: number; height: number };

// Present the library (web: the browser file input). Returns null if cancelled.
export async function pickPhoto(): Promise<PickedPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const a = result.assets[0];
  return { uri: a.uri, width: a.width, height: a.height };
}

// Resize the long edge to RESIZE.maxDimension and re-encode as JPEG.
export async function resizePhoto(photo: PickedPhoto): Promise<PickedPhoto> {
  const longEdge = Math.max(photo.width, photo.height);
  const actions =
    longEdge > RESIZE.maxDimension
      ? [
          photo.width >= photo.height
            ? { resize: { width: RESIZE.maxDimension } }
            : { resize: { height: RESIZE.maxDimension } },
        ]
      : [];
  const out = await ImageManipulator.manipulateAsync(photo.uri, actions, {
    compress: RESIZE.compress,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: out.uri, width: out.width, height: out.height };
}

// Upload the (already-resized) file and record it. photoId is any unique string
// (crypto.randomUUID at the call site) so the object path is stable.
export async function uploadMomentPhoto(
  momentId: string,
  photoId: string,
  photo: PickedPhoto,
  position: number,
): Promise<void> {
  const path = photoObjectPath(momentId, photoId);
  const base64 = await FileSystem.readAsStringAsync(photo.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const { error: upErr } = await supabase.storage
    .from('moment-photos')
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw upErr;
  const { error: rowErr } = await supabase.from('moment_photos').insert({
    moment_id: momentId,
    storage_path: path,
    width: photo.width,
    height: photo.height,
    position,
  });
  if (rowErr) throw rowErr;
}

// Short-lived signed URL for display (the bucket is private).
export async function signedPhotoUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('moment-photos')
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data.signedUrl;
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: exit 0. (`atob`/`Uint8Array` are available in the Hermes/RN runtime and web; no Node polyfill needed at type level.)

- [ ] **Step 3: Commit**

```bash
git add src/features/moments/photoUpload.ts
git commit -m "feat: photo pipeline — pick, resize, upload, signed URL"
```

---

### Task 6: MomentCard (TDD)

A Timeline card: optional photo, the moment title (Fraunces), the date and age-at-the-time, and who logged it. Photos load via signed URL through a small hook so the card stays presentational for testing.

**Files:**
- Create: `src/features/moments/MomentCard.tsx`
- Test: `src/features/moments/__tests__/MomentCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/moments/__tests__/MomentCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { MomentCard } from '../MomentCard';

const base = {
  id: 'm1',
  child_id: 'c1',
  milestone_id: 'rolled_over',
  custom_title: null,
  occurred_on: '2026-05-29',
  note: 'flipped right over',
  logged_by: 'me',
  created_at: '2026-05-29',
  moment_photos: [],
};

describe('MomentCard', () => {
  it('shows the celebration title, age at the time, and note', async () => {
    await render(
      <MomentCard moment={base} childDateOfBirth="2026-01-15" loggedByYou photoUrl={null} />,
    );
    expect(screen.getByText('They just rolled over!')).toBeTruthy();
    expect(screen.getByText('4 months, 2 weeks')).toBeTruthy();
    expect(screen.getByText('flipped right over')).toBeTruthy();
    expect(screen.getByText('Logged by you')).toBeTruthy();
  });

  it('uses a custom title and credits a co-parent', async () => {
    await render(
      <MomentCard
        moment={{ ...base, milestone_id: null, custom_title: 'First haircut', note: null }}
        childDateOfBirth="2026-01-15"
        loggedByYou={false}
        photoUrl={null}
      />,
    );
    expect(screen.getByText('First haircut')).toBeTruthy();
    expect(screen.getByText('Logged by a co-parent')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- MomentCard
```

Expected: FAIL — `Cannot find module '../MomentCard'`.

- [ ] **Step 3: Implement `src/features/moments/MomentCard.tsx`**

```tsx
import { Image, StyleSheet, Text, View } from 'react-native';
import { ageParts, formatAgeParts } from '../children/age';
import { color, font, hairline, space, type } from '../../theme/tokens';
import type { Moment } from './momentQueries';
import { momentTitle } from './momentText';

type Props = {
  moment: Moment;
  childDateOfBirth: string;
  loggedByYou: boolean;
  photoUrl: string | null;
};

export function MomentCard({ moment, childDateOfBirth, loggedByYou, photoUrl }: Props) {
  const ageText = formatAgeParts(ageParts(childDateOfBirth, moment.occurred_on));
  return (
    <View style={styles.card}>
      {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" /> : null}
      <View style={styles.body}>
        <Text style={styles.title}>{momentTitle(moment)}</Text>
        <Text style={styles.meta}>{`${moment.occurred_on} · ${ageText}`}</Text>
        {moment.note ? <Text style={styles.note}>{moment.note}</Text> : null}
        <Text style={styles.author}>{`Logged by ${loggedByYou ? 'you' : 'a co-parent'}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.paper, ...hairline, paddingBottom: space.lg },
  photo: { width: '100%', aspectRatio: 4 / 3, backgroundColor: color.paperRaise },
  body: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.xs },
  title: { fontFamily: font.display, fontSize: type.title, color: color.ink },
  meta: { fontFamily: font.body, fontSize: type.caption, color: color.inkMuted },
  note: { fontFamily: font.body, fontSize: type.body, color: color.ink, marginTop: space.xs, lineHeight: 22 },
  author: { fontFamily: font.medium, fontSize: type.caption, color: color.inkMuted, marginTop: space.sm },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- MomentCard && npx tsc --noEmit
```

Expected: 2 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/moments/MomentCard.tsx src/features/moments/__tests__/MomentCard.test.tsx
git commit -m "feat: Timeline moment card"
```

---

### Task 7: CaptureForm (TDD)

The capture form: an optional preselected milestone title (read-only when preset) or a custom title, a date (defaults today, YYYY-MM-DD like ChildForm), a note, and photo attach controls. Emits a structured submit; the screen (Task 9) owns the mutation and the actual photo picking.

**Files:**
- Create: `src/features/moments/CaptureForm.tsx`
- Test: `src/features/moments/__tests__/CaptureForm.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/moments/__tests__/CaptureForm.test.tsx`:

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import { CaptureForm } from '../CaptureForm';

describe('CaptureForm', () => {
  it('submits a milestone moment with the preset title shown', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(
      <CaptureForm
        presetTitle="They just rolled over!"
        defaultOccurredOn="2026-05-01"
        photoCount={0}
        onPickPhoto={jest.fn()}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText('They just rolled over!')).toBeTruthy();
    await user.type(screen.getByPlaceholderText('Add a little note (optional)'), 'flipped over');
    await user.press(screen.getByText('Save moment'));
    expect(onSubmit).toHaveBeenCalledWith({ customTitle: null, occurredOn: '2026-05-01', note: 'flipped over' });
  });

  it('requires a custom title when there is no preset', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(
      <CaptureForm
        presetTitle={null}
        defaultOccurredOn="2026-05-01"
        photoCount={0}
        onPickPhoto={jest.fn()}
        onSubmit={onSubmit}
      />,
    );
    await user.press(screen.getByText('Save moment'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Give this moment a name')).toBeTruthy();
    await user.type(screen.getByPlaceholderText('What happened?'), '  First haircut ');
    await user.press(screen.getByText('Save moment'));
    expect(onSubmit).toHaveBeenCalledWith({
      customTitle: 'First haircut',
      occurredOn: '2026-05-01',
      note: '',
    });
  });

  it('rejects an invalid date', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(
      <CaptureForm
        presetTitle="They just smiled!"
        defaultOccurredOn="2026-05-01"
        photoCount={0}
        onPickPhoto={jest.fn()}
        onSubmit={onSubmit}
      />,
    );
    await user.clear(screen.getByLabelText('When did it happen?'));
    await user.type(screen.getByLabelText('When did it happen?'), '2026-02-30');
    await user.press(screen.getByText('Save moment'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter the date as YYYY-MM-DD')).toBeTruthy();
  });

  it('reflects attached photo count on the add control', async () => {
    await render(
      <CaptureForm
        presetTitle="They just smiled!"
        defaultOccurredOn="2026-05-01"
        photoCount={2}
        onPickPhoto={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByText('2 photos added')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- CaptureForm
```

Expected: FAIL — `Cannot find module '../CaptureForm'`.

- [ ] **Step 3: Implement `src/features/moments/CaptureForm.tsx`**

```tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Field } from '../../components/Field';
import { PrimaryButton } from '../../components/PrimaryButton';
import { color, font, radius, space, type } from '../../theme/tokens';

export type CaptureSubmit = {
  customTitle: string | null;
  occurredOn: string;
  note: string;
};

type Props = {
  presetTitle: string | null;
  defaultOccurredOn: string;
  photoCount: number;
  onPickPhoto: () => void;
  onSubmit: (value: CaptureSubmit) => void;
  busy?: boolean;
};

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export function CaptureForm({
  presetTitle,
  defaultOccurredOn,
  photoCount,
  onPickPhoto,
  onSubmit,
  busy,
}: Props) {
  const [customTitle, setCustomTitle] = useState('');
  const [occurredOn, setOccurredOn] = useState(defaultOccurredOn);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmedTitle = customTitle.trim();
    if (presetTitle === null && !trimmedTitle) {
      setError('Give this moment a name');
      return;
    }
    if (!isRealDate(occurredOn)) {
      setError('Enter the date as YYYY-MM-DD');
      return;
    }
    setError(null);
    onSubmit({
      customTitle: presetTitle === null ? trimmedTitle : null,
      occurredOn,
      note,
    });
  };

  return (
    <View style={styles.container}>
      {presetTitle !== null ? (
        <Text style={styles.presetTitle}>{presetTitle}</Text>
      ) : (
        <Field
          label="Moment"
          placeholder="What happened?"
          value={customTitle}
          onChangeText={setCustomTitle}
        />
      )}
      <Field
        label="When did it happen?"
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        value={occurredOn}
        onChangeText={setOccurredOn}
      />
      <Field
        label="Note"
        placeholder="Add a little note (optional)"
        value={note}
        onChangeText={setNote}
        multiline
      />
      <Pressable style={styles.photoAdd} onPress={onPickPhoto} accessibilityRole="button">
        <Text style={styles.photoAddText}>
          {photoCount === 0
            ? 'Add a photo'
            : `${photoCount} photo${photoCount === 1 ? '' : 's'} added`}
        </Text>
      </Pressable>
      {error ? (
        <Text style={styles.error} role="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <PrimaryButton label="Save moment" onPress={handleSubmit} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.lg },
  presetTitle: { fontFamily: font.displayBold, fontSize: type.display, color: color.ink, letterSpacing: -0.3 },
  photoAdd: {
    borderWidth: 1,
    borderColor: color.rule,
    borderRadius: radius.md,
    borderStyle: 'dashed',
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  photoAddText: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
  error: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- CaptureForm && npx tsc --noEmit
```

Expected: 4 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/moments/CaptureForm.tsx src/features/moments/__tests__/CaptureForm.test.tsx
git commit -m "feat: capture form — preset/custom title, date, note, photo control"
```

---

### Task 8: Timeline home screen + tab reorder

Timeline becomes the home tab (first), then Milestones, then Family. The Timeline shows the selected child's moments newest-first with a quick-add button; its empty state invites the first capture.

**Files:**
- Modify: `src/app/(app)/_layout.tsx`
- Modify: `src/app/(app)/index.tsx`

- [ ] **Step 1: Replace `src/app/(app)/_layout.tsx`** (adds the Timeline tab, ordered first)

```tsx
import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import { SelectedChildProvider } from '@/features/children/selectedChild';
import { color, font } from '@/theme/tokens';

export default function AppLayout() {
  return (
    <SelectedChildProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: color.damson,
          tabBarInactiveTintColor: color.inkMuted,
          tabBarStyle: {
            backgroundColor: color.paper,
            borderTopColor: color.rule,
            borderTopWidth: 1,
          },
          tabBarLabelStyle: { fontFamily: font.medium, fontSize: 12 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Timeline',
            tabBarIcon: ({ color: c, size }) => <Feather name="clock" size={size} color={c} />,
          }}
        />
        <Tabs.Screen
          name="milestones"
          options={{
            title: 'Milestones',
            tabBarIcon: ({ color: c, size }) => <Feather name="book-open" size={size} color={c} />,
          }}
        />
        <Tabs.Screen
          name="family"
          options={{
            title: 'Family',
            tabBarIcon: ({ color: c, size }) => <Feather name="users" size={size} color={c} />,
          }}
        />
        <Tabs.Screen name="capture" options={{ href: null }} />
        <Tabs.Screen name="moment/[id]" options={{ href: null }} />
      </Tabs>
    </SelectedChildProvider>
  );
}
```

- [ ] **Step 2: Replace `src/app/(app)/index.tsx`** with the Timeline home

```tsx
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useSession } from '@/features/auth/useSession';
import { useSelectedChild } from '@/features/children/selectedChild';
import { MomentCard } from '@/features/moments/MomentCard';
import { useTimeline, type Moment } from '@/features/moments/momentQueries';
import { signedPhotoUrl } from '@/features/moments/photoUpload';
import { color, font, space, type } from '@/theme/tokens';

function useFirstPhotoUrls(moments: Moment[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        moments.map(async (m) => {
          const first = [...m.moment_photos].sort((a, b) => a.position - b.position)[0];
          if (!first) return null;
          const url = await signedPhotoUrl(first.storage_path);
          return url ? ([m.id, url] as const) : null;
        }),
      );
      if (!cancelled) setUrls(Object.fromEntries(entries.filter(Boolean) as [string, string][]));
    })();
    return () => {
      cancelled = true;
    };
  }, [moments]);
  return urls;
}

export default function TimelineScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { selected, loading } = useSelectedChild();
  const { data: moments = [] } = useTimeline(selected?.id ?? null);
  const photoUrls = useFirstPhotoUrls(moments);

  if (loading) return null;

  if (!selected) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Their story starts here</Text>
        <Text style={styles.emptyBody}>Add your little one, then capture their firsts.</Text>
        <View style={styles.emptyButton}>
          <PrimaryButton label="Add your child" onPress={() => router.push('/family')} />
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={moments}
      keyExtractor={(m) => m.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>TheyJust</Text>
            <Text style={styles.childLine}>{`${selected.name}'s story`}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/capture')}
            accessibilityRole="button"
            accessibilityLabel="Capture a moment"
            style={styles.add}
          >
            <Text style={styles.addPlus}>+</Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.feedEmpty}>
          <Text style={styles.feedEmptyTitle}>No moments yet</Text>
          <Text style={styles.feedEmptyBody}>Tap + to capture their first, or start from Milestones.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/moment/${item.id}`)}>
          <MomentCard
            moment={item}
            childDateOfBirth={selected.date_of_birth}
            loggedByYou={item.logged_by === session?.user.id}
            photoUrl={photoUrls[item.id] ?? null}
          />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: color.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.md,
  },
  brand: { fontFamily: font.displayBold, fontSize: type.display, color: color.ink, letterSpacing: -0.5 },
  childLine: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted },
  add: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.damson,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: { fontFamily: font.body, fontSize: 28, color: color.onDamson, lineHeight: 32 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xl, gap: space.md, backgroundColor: color.paper },
  emptyTitle: { fontFamily: font.display, fontSize: 30, color: color.ink, textAlign: 'center', letterSpacing: -0.3 },
  emptyBody: { fontFamily: font.body, fontSize: type.body, color: color.inkMuted, textAlign: 'center', marginBottom: space.sm },
  emptyButton: { alignSelf: 'stretch', paddingHorizontal: space.xl },
  feedEmpty: { padding: space.xl, alignItems: 'center', gap: space.sm },
  feedEmptyTitle: { fontFamily: font.display, fontSize: type.title, color: color.ink },
  feedEmptyBody: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted, textAlign: 'center' },
});
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npm test
```

Expected: tsc exit 0; full suite green (no new tests here; screens are verified at runtime in Task 12).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/_layout.tsx" "src/app/(app)/index.tsx"
git commit -m "feat: Timeline home tab (first), quick-add, per-child feed"
```

---

### Task 9: Capture modal screen + milestone trigger

The capture modal owns the picked-photo state, the create mutation, and (after the moment row exists) the photo uploads. Reached from the Timeline `+` (custom moment) or from tapping an unachieved milestone row (preselected).

**Files:**
- Create: `src/app/(app)/capture.tsx`
- Modify: `src/app/(app)/milestones.tsx` (tap an unachieved row → capture prefilled)

- [ ] **Step 1: Create `src/app/(app)/capture.tsx`**

```tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextButton } from '@/components/TextButton';
import { useSelectedChild } from '@/features/children/selectedChild';
import { CaptureForm, type CaptureSubmit } from '@/features/moments/CaptureForm';
import { CATALOGUE, celebrationText } from '@/features/milestones/catalogue';
import { useCreateMoment } from '@/features/moments/momentQueries';
import { pickPhoto, resizePhoto, uploadMomentPhoto, type PickedPhoto } from '@/features/moments/photoUpload';
import { todayIso } from '@/features/moments/today';
import { color, font, space, type } from '@/theme/tokens';

export default function CaptureScreen() {
  const router = useRouter();
  const { milestoneId } = useLocalSearchParams<{ milestoneId?: string }>();
  const { selected } = useSelectedChild();
  const createMoment = useCreateMoment(selected?.id ?? '');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);

  const entry = milestoneId ? CATALOGUE.find((e) => e.id === milestoneId) : undefined;
  const presetTitle = entry ? celebrationText(entry) : null;

  if (!selected) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Add a child first</Text>
        <TextButton label="Go to Family" onPress={() => router.replace('/family')} />
      </View>
    );
  }

  const handlePick = async () => {
    const picked = await pickPhoto();
    if (!picked) return;
    const resized = await resizePhoto(picked);
    setPhotos((prev) => [...prev, resized]);
  };

  const handleSubmit = async (value: CaptureSubmit) => {
    try {
      const moment = await createMoment.mutateAsync({
        childId: selected.id,
        milestoneId: entry?.id ?? null,
        customTitle: value.customTitle,
        occurredOn: value.occurredOn,
        note: value.note,
      });
      await Promise.all(
        photos.map((p, i) => uploadMomentPhoto(moment.id, `${moment.id}-${i}`, p, i)),
      );
      router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Capture a moment</Text>
        <TextButton label="Cancel" onPress={() => router.back()} tone="muted" />
      </View>
      <CaptureForm
        presetTitle={presetTitle}
        defaultOccurredOn={todayIso()}
        photoCount={photos.length}
        onPickPhoto={handlePick}
        onSubmit={handleSubmit}
        busy={createMoment.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { padding: space.lg, gap: space.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: font.displayBold, fontSize: type.display, color: color.ink, letterSpacing: -0.3 },
});
```

- [ ] **Step 2: Create `src/features/moments/today.ts`** (a tiny seam so the default date is testable/injectable)

```ts
// Local calendar date as YYYY-MM-DD (matches the age module's local-day rule).
export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
```

- [ ] **Step 3: Register the capture modal.** In `src/app/_layout.tsx` (the ROOT layout), the `(app)` group is a Stack.Screen inside the protected stack; the capture route is a tab-hidden screen (Task 8 set `href: null`). To present it as a modal, add a Stack around the tabs is unnecessary — expo-router presents `/capture` as a full screen pushed over the tabs, which is acceptable for MVP. No change needed here; `router.push('/capture')` already works because `capture.tsx` lives in the `(app)` group.

Verify the route resolves:

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Modify `src/app/(app)/milestones.tsx`** — make an unachieved row tappable to capture. Change the `renderItem` and add `useRouter`.

Find the imports line:

```tsx
import { useRouter } from 'expo-router';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
```

(already present from Plan 2). Then change the `renderItem` from:

```tsx
      renderItem={({ item }) => (
        <MilestoneRow
          entry={item}
          comparisonMonths={age.comparisonMonths}
          achievedAgeText={achieved[item.id] ?? null}
        />
      )}
```

to:

```tsx
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            achieved[item.id]
              ? undefined
              : router.push({ pathname: '/capture', params: { milestoneId: item.id } })
          }
          accessibilityRole="button"
          accessibilityLabel={achieved[item.id] ? item.title : `Log ${item.title}`}
        >
          <MilestoneRow
            entry={item}
            comparisonMonths={age.comparisonMonths}
            achievedAgeText={achieved[item.id] ?? null}
          />
        </Pressable>
      )}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && npm test
```

Expected: tsc exit 0; full suite green.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/capture.tsx" src/features/moments/today.ts "src/app/(app)/milestones.tsx"
git commit -m "feat: capture modal — create moment + upload photos; milestone rows trigger capture"
```

---

### Task 10: Moment detail screen (view / edit / delete)

Full view of a moment: photo(s), title, date, age, note, who logged it. Edit the date/note inline; delete with a confirm. Share (Task 11) plugs in here.

**Files:**
- Create: `src/app/(app)/moment/[id].tsx`

- [ ] **Step 1: Create `src/app/(app)/moment/[id].tsx`**

```tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Field } from '@/components/Field';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextButton } from '@/components/TextButton';
import { ageParts, formatAgeParts } from '@/features/children/age';
import { useSelectedChild } from '@/features/children/selectedChild';
import {
  useDeleteMoment,
  useTimeline,
  useUpdateMoment,
  type Moment,
} from '@/features/moments/momentQueries';
import { momentTitle } from '@/features/moments/momentText';
import { signedPhotoUrl } from '@/features/moments/photoUpload';
import { color, font, space, type } from '@/theme/tokens';

export default function MomentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selected } = useSelectedChild();
  const { data: moments = [] } = useTimeline(selected?.id ?? null);
  const updateMoment = useUpdateMoment(selected?.id ?? '');
  const deleteMoment = useDeleteMoment(selected?.id ?? '');
  const moment = moments.find((m) => m.id === id) as Moment | undefined;

  const [editing, setEditing] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const first = moment ? [...moment.moment_photos].sort((a, b) => a.position - b.position)[0] : null;
    if (!first) {
      setPhotoUrl(null);
      return;
    }
    signedPhotoUrl(first.storage_path).then((u) => {
      if (!cancelled) setPhotoUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [moment]);

  if (!moment || !selected) {
    return (
      <View style={styles.screen}>
        <Text style={styles.notFound}>This moment is no longer here.</Text>
        <TextButton label="Back to Timeline" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const ageText = formatAgeParts(ageParts(selected.date_of_birth, moment.occurred_on));

  const confirmDelete = () =>
    Alert.alert('Delete this moment?', 'This cannot be undone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteMoment.mutate(moment.id, { onSuccess: () => router.replace('/') }),
      },
    ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TextButton label="Back" onPress={() => router.back()} tone="muted" />
        {!editing ? <TextButton label="Edit" onPress={() => setEditing(true)} /> : null}
      </View>
      {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" /> : null}
      <Text style={styles.title}>{momentTitle(moment)}</Text>
      <Text style={styles.meta}>{`${moment.occurred_on} · ${ageText}`}</Text>

      {editing ? (
        <EditFields
          moment={moment}
          busy={updateMoment.isPending}
          onCancel={() => setEditing(false)}
          onSave={(edit) =>
            updateMoment.mutate({ id: moment.id, edit }, { onSuccess: () => setEditing(false) })
          }
        />
      ) : (
        <>
          {moment.note ? <Text style={styles.note}>{moment.note}</Text> : null}
          <View style={styles.actions}>
            <TextButton label="Delete moment" onPress={confirmDelete} tone="muted" />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function EditFields({
  moment,
  busy,
  onCancel,
  onSave,
}: {
  moment: Moment;
  busy: boolean;
  onCancel: () => void;
  onSave: (edit: { occurredOn: string; note: string }) => void;
}) {
  const [occurredOn, setOccurredOn] = useState(moment.occurred_on);
  const [note, setNote] = useState(moment.note ?? '');
  return (
    <View style={styles.edit}>
      <Field
        label="When did it happen?"
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        value={occurredOn}
        onChangeText={setOccurredOn}
      />
      <Field label="Note" placeholder="Add a little note" value={note} onChangeText={setNote} multiline />
      <PrimaryButton label="Save changes" onPress={() => onSave({ occurredOn, note })} busy={busy} />
      <TextButton label="Cancel" onPress={onCancel} tone="muted" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { padding: space.lg, gap: space.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 10, backgroundColor: color.paperRaise },
  title: { fontFamily: font.displayBold, fontSize: type.hero, color: color.ink, letterSpacing: -0.5 },
  meta: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted },
  note: { fontFamily: font.body, fontSize: type.body, color: color.ink, lineHeight: 24, marginTop: space.sm },
  actions: { marginTop: space.xl, borderTopWidth: 1, borderTopColor: color.rule, paddingTop: space.lg },
  edit: { gap: space.lg, marginTop: space.sm },
  notFound: { fontFamily: font.body, fontSize: type.body, color: color.inkMuted, padding: space.xl },
});
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit && npm test
```

Expected: tsc exit 0; full suite green.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/moment/[id].tsx"
git commit -m "feat: moment detail — view, inline edit, delete with confirm"
```

---

### Task 11: Share card (render to image + share)

A keepsake card rendered off-screen to an image and handed to the native share sheet: the photo (if any) and the celebration line with the age. This is the organic-growth surface (spec §4.4).

**Files:**
- Create: `src/features/moments/ShareCard.tsx`
- Create: `src/features/moments/shareMoment.ts`
- Modify: `src/app/(app)/moment/[id].tsx` (a Share action)

- [ ] **Step 1: Create `src/features/moments/ShareCard.tsx`**

```tsx
import { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { color, font, space } from '../../theme/tokens';

type Props = {
  title: string;
  ageLine: string;
  photoUrl: string | null;
};

// A fixed-size keepsake card captured to an image by shareMoment(). Rendered
// off-screen; not part of the visible layout.
export const ShareCard = forwardRef<View, Props>(function ShareCard(
  { title, ageLine, photoUrl },
  ref,
) {
  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" /> : null}
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.age}>{ageLine}</Text>
        <Text style={styles.brand}>TheyJust</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: 1080, backgroundColor: color.paper },
  photo: { width: 1080, height: 810, backgroundColor: color.paperRaise },
  body: { padding: 72, gap: 16 },
  title: { fontFamily: font.displayBold, fontSize: 88, color: color.ink, letterSpacing: -1 },
  age: { fontFamily: font.serifItalic, fontSize: 44, color: color.damson },
  brand: { fontFamily: font.medium, fontSize: 32, color: color.inkMuted, marginTop: 24 },
});
```

- [ ] **Step 2: Create `src/features/moments/shareMoment.ts`**

```ts
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import type { View } from 'react-native';

// Capture the off-screen ShareCard to a PNG and hand it to the native share
// sheet. No-ops gracefully if sharing is unavailable on the platform.
export async function shareMomentCard(ref: React.RefObject<View>): Promise<void> {
  if (!ref.current) return;
  const uri = await captureRef(ref, { format: 'png', quality: 1 });
  if (!(await Sharing.isAvailableAsync())) return;
  await Sharing.shareAsync(uri);
}
```

- [ ] **Step 3: Wire a Share action into `src/app/(app)/moment/[id].tsx`.** Add imports (merge `useRef` into the existing `react` import; `View` is already imported from react-native):

```tsx
import { useRef } from 'react';
import { ShareCard } from '@/features/moments/ShareCard';
import { shareMomentCard } from '@/features/moments/shareMoment';
```

Add a ref near the other hooks:

```tsx
  const shareRef = useRef<View>(null);
```

In the non-editing branch, add a Share button beside Delete:

```tsx
          <View style={styles.actions}>
            <TextButton label="Share this memory" onPress={() => shareMomentCard(shareRef)} />
            <TextButton label="Delete moment" onPress={confirmDelete} tone="muted" />
          </View>
```

And render the off-screen card once (add just before the closing `</ScrollView>`):

```tsx
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard title={momentTitle(moment)} ageLine={`at ${ageText}`} photoUrl={photoUrl} />
      </View>
```

Add the offscreen style:

```tsx
  offscreen: { position: 'absolute', left: -10000, top: 0 },
```

(The card reuses `momentTitle(moment)` and the existing `ageText` — no new momentText export.)

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npm test
```

Expected: tsc exit 0; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/features/moments/ShareCard.tsx src/features/moments/shareMoment.ts "src/app/(app)/moment/[id].tsx"
git commit -m "feat: share a rendered keepsake card via the native share sheet"
```

---

### Task 12: Full gates + runtime verification

**Files:** none new.

- [ ] **Step 1: Full local gates**

```bash
npx tsc --noEmit && npm test && supabase db reset && supabase test db
```

Expected: tsc exit 0; all Jest suites green; pgTAP 4 files / 52 assertions PASS.

- [ ] **Step 2: Web export smoke check**

```bash
npx expo export --platform web 2>&1 | tail -3 && rm -rf dist
```

Expected: exit 0.

- [ ] **Step 3: Report DONE.** The coordinator performs runtime verification in the browser against local Supabase (expo-image-picker uses the browser file input on web, so the full photo path is exercisable): sign in → add a child → Timeline empty state → capture a custom moment with a photo (pick a local image, it resizes + uploads) → it appears in the Timeline with the photo → open the moment, edit the note, save → capture a milestone moment from the Milestones tab (tap an unachieved row) → confirm it shows as achieved with the damson stamp on Milestones → delete a moment. Watch the console for errors; confirm the photo actually round-trips through Storage (signed URL renders).

---

## Self-review (done at writing time)

- **Spec coverage:** §4 Timeline (feed, per-child, age-at-time, who logged it, quick-add) → Task 8; §4 capture flow (milestone-preselected or custom, date, note, photos, instant save) → Tasks 7+9; §4 moment detail (view/edit/delete, share) → Tasks 10+11; §4 share card (photo + "They just … at N months") → Task 11; §7 optimistic (moment appears immediately, photo upload decoupled with retry-on-error via mutation) → Tasks 4+9 (full restart-surviving persistence explicitly deferred, stated in Architecture); photos private + signed URLs (§6) → Tasks 1+5. Corrected-vs-chronological: the card/detail use chronological age-at-the-time (spec §4), while Milestones keeps corrected comparison (Plan 2) — the two age semantics stay in their right places.
- **Placeholders:** none — every step carries complete code or an exact command. Task 5 and the screen tasks are thin/native and are runtime-verified (Task 12) rather than unit-tested, which is stated.
- **Type consistency:** `Moment`/`MomentPhoto`/`NewMoment`/`MomentEdit` (Task 4) match usage in Tasks 6, 8, 9, 10; `CaptureSubmit` (Task 7) matches Task 9; `momentTitle` (Task 2), `photoObjectPath`/`RESIZE` (Task 3), `pickPhoto`/`resizePhoto`/`uploadMomentPhoto`/`signedPhotoUrl` (Task 5), `todayIso` (Task 9) all match their call sites; `celebrationText`/`CATALOGUE`/`ageParts`/`formatAgeParts` reused from Plan 2 with their real signatures.
