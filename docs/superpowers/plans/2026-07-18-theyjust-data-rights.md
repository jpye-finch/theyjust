# Data Rights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a parent take all their data out, and delete their account for good. These are the two things Apple requires before TheyJust can ship.

**Architecture:** Export is built entirely on the client from rows the parent can already read, so RLS is what scopes it. Deletion runs in the project's first Edge Function, because two things are impossible from the client: removing a row from `auth.users`, and removing a storage object (a `storage.protect_delete()` trigger blocks SQL deletes, so it must go through the Storage API with the service role).

**Tech Stack:** Expo SDK 57, Supabase (Postgres + RLS + Edge Functions on Deno), jest-expo + RNTL v14, pgTAP, JSZip.

---

## Scope

**In:** data export (JSON + photos, zipped and shared), account deletion (storage objects, family rows, auth user), the Family-screen surfaces for both, and a fix for the pgTAP assertion that breaks local runs.

**Out — deliberately deferred:**

- **Co-parent invites and any sharing.** Cut from v1 as too complex for the value: it is the only feature needing `SECURITY DEFINER` RPCs and an invite lifecycle. The `invites` table stays in the schema unused, and `create_family` keeps returning an existing membership's family, so nothing has to be undone when sharing returns. Consequence to hold in mind: with sharing gone, the **share card is the only way anything leaves the app**, so it carries the whole growth surface.
- **Plan 5 (pre-launch hardening):** encrypting the persisted session, production Supabase auth config (`enable_confirmations`, `site_url`, SMTP), and OAuth for Apple + Google. Because Google is in scope there, Sign in with Apple becomes mandatory for App Store review, and both need an Apple Developer account.

## Context an implementer needs

- `npm test` pins `TZ=America/Los_Angeles`; a bare `npx jest` uses the host zone. Always use `npm test`.
- Local `tsc` needs `rm -f .expo/types/router.d.ts` first: the generated typed-routes file goes stale and CI never generates it.
- `Alert.alert` is a **no-op on react-native-web**. Always use `notify` / `confirmDestructive` from `src/lib/dialog.ts`.
- Imports: `@/` for `@/components`, `@/features`, `@/lib`, `@/theme`. Cross-feature and same-directory imports stay relative inside `src/features`.
- DESIGN.md: Fraunces is the celebration voice **only**; Karla does all functional work. No cards, no pills; hairline rules and generous margins.
- Local Supabase must be running (`supabase start`) or every screen past sign-in fails with a bare `Failed to fetch`.

## File structure

| File | Responsibility |
|---|---|
| `src/features/family/exportBundle.ts` | pure builder: rows in, export JSON out |
| `src/features/family/__tests__/exportBundle.test.ts` | unit tests for the JSON shape |
| `src/features/family/exportData.ts` | fetch + zip + hand to the share sheet |
| `supabase/functions/delete-account/index.ts` | Edge Function: storage objects, family rows, auth user |
| `src/features/family/deleteAccount.ts` | client call + session teardown |
| `src/features/family/__tests__/deleteAccount.test.ts` | unit tests for the above |
| `src/app/(app)/family.tsx` | export + delete surfaces; replace raw `Alert` |
| `supabase/tests/0003_create_family.test.sql` | assert a delta, not an absolute row count |

---

### Task 1: Export bundle builder (TDD)

Pure function: rows in, the JSON a parent receives out. Keeping it pure means the shape is testable without touching the network.

**Files:**
- Create: `src/features/family/exportBundle.ts`
- Test: `src/features/family/__tests__/exportBundle.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/family/__tests__/exportBundle.test.ts`:

```ts
import { buildExportBundle, photoFileName } from '../exportBundle';

const child = {
  id: 'c1',
  family_id: 'f1',
  name: 'Wren',
  date_of_birth: '2026-01-15',
  due_date: null,
};

const moment = {
  id: 'm1',
  child_id: 'c1',
  milestone_id: 'rolled_over',
  custom_title: null,
  occurred_on: '2026-05-29',
  note: 'flipped right over',
  logged_by: 'u1',
  created_at: '2026-05-29T10:00:00.000Z',
  moment_photos: [
    { id: 'p1', moment_id: 'm1', storage_path: 'm1/m1-0.jpg', width: 100, height: 80, position: 0 },
  ],
};

describe('buildExportBundle', () => {
  it('nests moments under their child and resolves the celebration title', () => {
    const bundle = buildExportBundle('2026-07-18T09:00:00.000Z', [child], [moment]);

    expect(bundle.exportedAt).toBe('2026-07-18T09:00:00.000Z');
    expect(bundle.children).toHaveLength(1);
    expect(bundle.children[0].name).toBe('Wren');
    expect(bundle.children[0].moments[0].title).toBe('They just rolled over!');
    expect(bundle.children[0].moments[0].occurredOn).toBe('2026-05-29');
    expect(bundle.children[0].moments[0].note).toBe('flipped right over');
  });

  it('points each moment at the photo files packed beside the JSON', () => {
    const bundle = buildExportBundle('2026-07-18T09:00:00.000Z', [child], [moment]);
    expect(bundle.children[0].moments[0].photos).toEqual(['photos/m1-0.jpg']);
  });

  it('keeps a custom title verbatim and records no milestone', () => {
    const custom = { ...moment, milestone_id: null, custom_title: 'First haircut' };
    const bundle = buildExportBundle('2026-07-18T09:00:00.000Z', [child], [custom]);
    expect(bundle.children[0].moments[0].title).toBe('First haircut');
    expect(bundle.children[0].moments[0].milestoneId).toBeNull();
  });

  it('includes a child with no moments rather than dropping them', () => {
    const bundle = buildExportBundle('2026-07-18T09:00:00.000Z', [child], []);
    expect(bundle.children[0].moments).toEqual([]);
  });

  it('orders a moment\'s photos by position', () => {
    const twoPhotos = {
      ...moment,
      moment_photos: [
        { id: 'p2', moment_id: 'm1', storage_path: 'm1/m1-1.jpg', width: 1, height: 1, position: 1 },
        { id: 'p1', moment_id: 'm1', storage_path: 'm1/m1-0.jpg', width: 1, height: 1, position: 0 },
      ],
    };
    const bundle = buildExportBundle('2026-07-18T09:00:00.000Z', [child], [twoPhotos]);
    expect(bundle.children[0].moments[0].photos).toEqual(['photos/m1-0.jpg', 'photos/m1-1.jpg']);
  });
});

describe('photoFileName', () => {
  it('flattens a storage path to a unique file name', () => {
    expect(photoFileName('m1/m1-0.jpg')).toBe('m1-0.jpg');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- exportBundle
```

Expected: FAIL, `Cannot find module '../exportBundle'`.

- [ ] **Step 3: Implement `src/features/family/exportBundle.ts`**

```ts
import type { Child } from '../children/queries';
import type { Moment } from '../moments/momentQueries';
import { momentTitle } from '../moments/momentText';

export type ExportBundle = {
  exportedAt: string;
  children: {
    name: string;
    dateOfBirth: string;
    dueDate: string | null;
    moments: {
      title: string;
      milestoneId: string | null;
      occurredOn: string;
      note: string | null;
      photos: string[];
    }[];
  }[];
};

/** Storage paths are `{momentId}/{photoId}.jpg`; the zip keeps them flat. */
export function photoFileName(storagePath: string): string {
  return storagePath.split('/').pop() as string;
}

// A parent's export should read like their book, not like our database: the
// celebration wording is resolved here, and internal ids are left out.
export function buildExportBundle(
  exportedAt: string,
  children: Child[],
  moments: Moment[],
): ExportBundle {
  return {
    exportedAt,
    children: children.map((child) => ({
      name: child.name,
      dateOfBirth: child.date_of_birth,
      dueDate: child.due_date,
      moments: moments
        .filter((moment) => moment.child_id === child.id)
        .map((moment) => ({
          title: momentTitle(moment),
          milestoneId: moment.milestone_id,
          occurredOn: moment.occurred_on,
          note: moment.note,
          photos: [...moment.moment_photos]
            .sort((a, b) => a.position - b.position)
            .map((photo) => `photos/${photoFileName(photo.storage_path)}`),
        })),
    })),
  };
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm test -- exportBundle && npx tsc --noEmit
```

Expected: 6 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/family/exportBundle.ts src/features/family/__tests__/exportBundle.test.ts
git commit -m "feat: export bundle builder — the parent's book, not our schema"
```

---

### Task 2: Zip the export and hand it to the share sheet

**Files:**
- Create: `src/features/family/exportData.ts`

- [ ] **Step 1: Install JSZip**

```bash
npm install jszip
```

JSZip is pure JavaScript, so it works unchanged on iOS, Android and web. Everything else here is already installed (`expo-file-system`, `expo-sharing`).

- [ ] **Step 2: Implement `src/features/family/exportData.ts`**

```ts
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import { Platform } from 'react-native';
import { fetchChildren } from '../children/queries';
import { fetchTimeline } from '../moments/momentQueries';
import { signedPhotoUrl } from '../moments/photoUpload';
import { buildExportBundle, photoFileName } from './exportBundle';

// Everything here is read with the parent's own session, so RLS is what keeps
// the export scoped to their family. Photos are pulled through short-lived
// signed URLs, the same way the app displays them.
export async function exportEverything(exportedAt: string): Promise<void> {
  const children = await fetchChildren();
  const moments = (
    await Promise.all(children.map((child) => fetchTimeline(child.id)))
  ).flat();

  const zip = new JSZip();
  zip.file(
    'theyjust-export.json',
    JSON.stringify(buildExportBundle(exportedAt, children, moments), null, 2),
  );

  const photos = zip.folder('photos');
  for (const moment of moments) {
    for (const photo of moment.moment_photos) {
      const url = await signedPhotoUrl(photo.storage_path);
      if (!url) continue;
      const blob = await (await fetch(url)).blob();
      photos?.file(photoFileName(photo.storage_path), blob);
    }
  }

  const fileName = `theyjust-export-${exportedAt.slice(0, 10)}.zip`;

  if (Platform.OS === 'web') {
    // No share sheet on web: hand the browser a download instead.
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  const base64 = await zip.generateAsync({ type: 'base64' });
  const target = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(target, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target);
  }
}
```

- [ ] **Step 3: Verify**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test
```

Expected: tsc exit 0; full suite green. No unit test here: the module is a thin shell over the network, the filesystem and the share sheet, and its one piece of real logic (the bundle shape) is covered by Task 1. It is exercised for real in Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/features/family/exportData.ts package.json package-lock.json
git commit -m "feat: export everything as a zip — JSON plus the photos, shared or downloaded"
```

---

### Task 3: Account-deletion Edge Function

The first Edge Function in the project. It exists because two things are impossible from the client: deleting a row from `auth.users`, and deleting a storage object (a `storage.protect_delete()` trigger blocks SQL deletes, so it must go through the Storage API).

It keeps a last-member check even though sharing is cut from v1. Today every family has exactly one member, so the branch is inert — but deletion is irreversible, sharing is deferred rather than abandoned, and the check costs one query. Without it, the day invites return, the first co-parent to delete their account takes the other parent's entire history with them.

**Files:**
- Create: `supabase/functions/delete-account/index.ts`

- [ ] **Step 1: Implement `supabase/functions/delete-account/index.ts`**

```ts
// Deno Edge Function. Deletes the caller's account: their photos from storage,
// any family they are the last member of (the DB cascades children, moments and
// photo rows), their memberships, and finally their auth user.
//
// It runs with the service role, so the FIRST thing it does is establish who is
// actually calling by verifying their JWT. Nothing is derived from the body.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string,
  );

  const { data: caller, error: callerError } = await admin.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (callerError || !caller?.user) {
    return new Response(JSON.stringify({ error: 'Not signed in' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const userId = caller.user.id;

  const { data: memberships } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId);

  // Only families where nobody else is left may be destroyed.
  const familyIds = (memberships ?? []).map((m) => m.family_id as string);
  const soleOwned: string[] = [];
  for (const familyId of familyIds) {
    const { count } = await admin
      .from('family_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('family_id', familyId);
    if ((count ?? 0) <= 1) soleOwned.push(familyId);
  }

  if (soleOwned.length > 0) {
    const { data: children } = await admin
      .from('children')
      .select('id')
      .in('family_id', soleOwned);
    const childIds = (children ?? []).map((c) => c.id as string);

    if (childIds.length > 0) {
      const { data: moments } = await admin
        .from('moments')
        .select('id')
        .in('child_id', childIds);
      const momentIds = (moments ?? []).map((m) => m.id as string);

      if (momentIds.length > 0) {
        const { data: photos } = await admin
          .from('moment_photos')
          .select('storage_path')
          .in('moment_id', momentIds);
        const paths = (photos ?? []).map((p) => p.storage_path as string);
        // Storage objects never cascade, and SQL cannot delete them.
        if (paths.length > 0) {
          await admin.storage.from('moment-photos').remove(paths);
        }
      }
    }

    // Cascades children -> moments -> moment_photos, plus invites and memberships.
    await admin.from('families').delete().in('id', soleOwned);
  }

  await admin.from('family_members').delete().eq('user_id', userId);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ deleted: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 2: Serve it locally and check it refuses an anonymous caller**

```bash
supabase functions serve delete-account &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:54321/functions/v1/delete-account
```

Expected: `401`. With no Authorization header there is no caller to establish, so nothing is deleted.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/delete-account/index.ts
git commit -m "feat(edge): delete-account — storage objects, sole-owned families, auth user"
```

---

### Task 4: Delete-account client (TDD)

**Files:**
- Create: `src/features/family/deleteAccount.ts`
- Test: `src/features/family/__tests__/deleteAccount.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/family/__tests__/deleteAccount.test.ts`:

```ts
import { deleteAccount } from '../deleteAccount';
import { supabase } from '../../../lib/supabase';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    auth: { signOut: jest.fn() },
  },
}));

const mockedInvoke = supabase.functions.invoke as jest.Mock;
const mockedSignOut = supabase.auth.signOut as jest.Mock;

afterEach(() => jest.clearAllMocks());

describe('deleteAccount', () => {
  it('calls the edge function and then signs the user out', async () => {
    mockedInvoke.mockResolvedValue({ data: { deleted: true }, error: null });
    await deleteAccount();
    expect(mockedInvoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
    expect(mockedSignOut).toHaveBeenCalled();
  });

  it('throws and does NOT sign out when deletion failed', async () => {
    mockedInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(deleteAccount()).rejects.toThrow('boom');
    expect(mockedSignOut).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- deleteAccount
```

Expected: FAIL, `Cannot find module '../deleteAccount'`.

- [ ] **Step 3: Implement `src/features/family/deleteAccount.ts`**

```ts
import { supabase } from '../../lib/supabase';

// Signing out only happens after the server confirms the account is gone: if we
// signed out first and deletion failed, the parent would be locked out of an
// account that still exists.
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw new Error(error.message);
  await supabase.auth.signOut();
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm test -- deleteAccount && npx tsc --noEmit
```

Expected: 2 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/family/deleteAccount.ts src/features/family/__tests__/deleteAccount.test.ts
git commit -m "feat: delete-account client — sign out only once the server confirms"
```

---

### Task 5: Wire export and deletion into the Family screen

Also fixes a live bug: `family.tsx` still calls `Alert.alert` directly for the sign-out confirm, which is a no-op on react-native-web, so that confirm never appears there.

**Files:**
- Modify: `src/app/(app)/family.tsx`

- [ ] **Step 1: Drop the raw Alert.** Remove `Alert` from the `react-native` import line, and add beside the other `@/lib` imports:

```tsx
import { confirmDestructive, notify } from '@/lib/dialog';
```

- [ ] **Step 2: Replace the sign-out confirm** with the cross-platform helper:

```tsx
  const confirmSignOut = () =>
    confirmDestructive('Sign out?', 'You can sign back in any time.', 'Sign out', () => {
      void supabase.auth.signOut();
    });
```

- [ ] **Step 3: Add the data surfaces.** Add these imports:

```tsx
import { deleteAccount } from '@/features/family/deleteAccount';
import { exportEverything } from '@/features/family/exportData';
```

Inside the component, beside the existing hooks:

```tsx
  const [exporting, setExporting] = useState(false);

  const runExport = async () => {
    setExporting(true);
    try {
      await exportEverything(new Date().toISOString());
    } catch (e) {
      notify('Could not export', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = () =>
    confirmDestructive(
      'Delete your account?',
      'Every moment and photo is erased for good. This cannot be undone.',
      'Delete',
      () => {
        deleteAccount().catch((e) =>
          notify('Could not delete', e instanceof Error ? e.message : 'Please try again.'),
        );
      },
    );
```

Render them after the child list, before Sign out:

```tsx
        <View style={styles.section}>
          <Text style={styles.heading}>Your data</Text>
          <Text style={styles.blurb}>
            Take a copy whenever you like: every moment as JSON, with the photos beside it.
          </Text>
          <TextButton
            label={exporting ? 'Preparing your export…' : 'Export everything'}
            onPress={runExport}
          />
          <TextButton label="Delete my account" onPress={confirmDelete} tone="muted" />
        </View>
```

Add these two styles beside the existing ones (`hairline` comes from `@/theme/tokens`; add it to that import if absent):

```tsx
  section: { gap: space.sm, paddingVertical: space.lg, ...hairline },
  blurb: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted, lineHeight: 21 },
```

- [ ] **Step 4: Verify**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test
grep -n "Alert" "src/app/(app)/family.tsx"
```

Expected: tsc exit 0; full suite green; the grep returns no output.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/family.tsx"
git commit -m "feat: family screen gains export and account deletion; sign-out confirm now works on web"
```

---

### Task 6: Make the pgTAP family-count assertion robust

`0003_create_family.test.sql` asserts `count(*) = 2` over the whole table, so the suite fails locally as soon as the development database holds real families. CI passes only because it starts empty. Assert the delta instead.

**Files:**
- Modify: `supabase/tests/0003_create_family.test.sql`

- [ ] **Step 1: Replace the absolute count.** Change:

```sql
select is((select count(*) from public.families), 2::bigint,
  'and the total family count is unchanged');
```

to:

```sql
-- Count only the families this test created. An absolute count made the suite
-- fail on any developer database that already had real families in it.
select is(
  (select count(*) from public.families
    where name in ('Pye-Finch family', 'Should not exist')),
  1::bigint,
  'the second call created no extra family');
```

- [ ] **Step 2: Verify it passes against a database that already holds data**

```bash
supabase test db
```

Expected: 4 files pass, without needing `supabase db reset` first.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/0003_create_family.test.sql
git commit -m "test(db): assert the created-family delta, not an absolute table count"
```

---

### Task 7: Full gates and runtime verification

**Files:** none new.

- [ ] **Step 1: Full local gates**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test && supabase db reset && supabase test db
```

Expected: tsc exit 0; Jest green; pgTAP 4 files pass.

- [ ] **Step 2: Web export smoke check**

```bash
npx expo export --platform web 2>&1 | tail -3 && rm -rf dist
```

Expected: exit 0.

- [ ] **Step 3: Runtime verification.** The coordinator drives the browser against local Supabase:

1. **Export.** With a child and at least one photographed moment, Family tab, Export everything. On web a zip downloads. Open it: `theyjust-export.json` lists the children with their moments and celebration titles, and `photos/` holds the image files named as the JSON references them.
2. **Export with no photos.** A family whose moments have no photos still exports valid JSON and an empty `photos/` folder, rather than failing.
3. **Deletion.** Sign up a throwaway account, add a child, capture a moment with a photo, then delete the account. Confirm in SQL that the family, children, moments and `moment_photos` rows are gone, that `storage.objects` holds no objects under that moment's path, and that the `auth.users` row is gone. Confirm the app has returned to the sign-in screen.
4. **Deletion cannot be triggered anonymously.** The `curl` check from Task 3 Step 2 still returns 401.

Storage emptiness is the easiest thing here to get wrong, so verify it in SQL rather than by eye.

---

## Self-review

**Spec coverage.** §6 privacy: in-app data export as JSON + photos (Tasks 1, 2, 5) and full account deletion cascading family → children → moments → storage objects (Tasks 3, 4, 5), both named there as v1 requirements that Apple mandates regardless. §4.5 Family & settings: the account, data export and account deletion rows (Task 5). §9: session encryption, production auth config and OAuth are explicitly deferred to Plan 5, and co-parent invites are deferred indefinitely, both recorded in Scope.

**Deliberate gaps.** Export holds the whole zip in memory, which is fine for a first year of moments but would strain on thousands of photos; the fix (streaming, or a size warning) is not worth building before anyone has that much data. The Edge Function has no automated test because the repo has no Deno test harness; Task 7 step 3 verifies its real branch by hand, and step 4 verifies it refuses anonymous callers. The last-member branch is inert until sharing returns, and is justified inline in Task 3.

**Type consistency.** `buildExportBundle(exportedAt, children, moments)` and `photoFileName(storagePath)` are defined in Task 1 and used in Task 2. `deleteAccount()` is defined in Task 4 and called in Task 5. `Child` and `Moment` come from the shipped `children/queries` and `moments/momentQueries`; `momentTitle` from `moments/momentText`; `notify` and `confirmDestructive` match `src/lib/dialog.ts`; `signedPhotoUrl` and `fetchTimeline` match the shipped photo and moment modules.
