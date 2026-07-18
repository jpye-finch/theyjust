# Sharing & Data Rights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a second parent join the family by code, let a parent take all their data out, and let them delete the account for good.

**Architecture:** Two `SECURITY DEFINER` RPCs carry the invite flow, because an invitee is not yet a family member and every `invites` policy is gated on `is_family_member` — they cannot read their own invite under RLS. Account deletion runs in the project's first Edge Function, because deleting `auth.users` needs the service role and storage objects cannot be removed from SQL at all (a `storage.protect_delete()` trigger blocks it). Export is built entirely on the client from data the user can already read.

**Tech Stack:** Expo SDK 57, Supabase (Postgres + RLS + Edge Functions on Deno), TanStack Query v5, jest-expo + RNTL v14, pgTAP, JSZip.

---

## Scope

**In:** co-parent invites (create, share, accept, revoke), data export (JSON + photos, zipped and shared), account deletion (storage + DB + auth user), and the Family screen surfaces for all three.

**Out, and owned by Plan 5:** encrypting the persisted session, production Supabase auth config (`enable_confirmations`, `site_url`, SMTP), and OAuth for Apple + Google. Note for Plan 5: because Google is in scope, Sign in with Apple becomes mandatory for App Store review, and both need Jonathan's Apple Developer account.

## Context an implementer needs

- `npm test` pins `TZ=America/Los_Angeles`; a bare `npx jest` uses the host zone. Always use `npm test`.
- Local `tsc` needs `rm -f .expo/types/router.d.ts` first: the generated typed-routes file goes stale against new routes and CI never generates it.
- `Alert.alert` is a **no-op on react-native-web**. Always use `notify` / `confirmDestructive` from `src/lib/dialog.ts`.
- Imports: `@/` for `@/components`, `@/features`, `@/lib`, `@/theme`. Cross-feature and same-directory imports stay relative inside `src/features`.
- DESIGN.md: Fraunces is the celebration voice **only**; Karla does all functional work. Screen chrome is quiet Karla. No cards, no pills; hairline rules and generous margins.
- pgTAP currently asserts absolute row counts, so local runs fail once the dev database holds real data. CI runs against a fresh database. Task 11 fixes the brittle assertion.

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260718000001_invites.sql` | `generate_invite_code`, `create_invite`, `accept_invite`, `invites` UPDATE policy |
| `supabase/tests/0005_invites.test.sql` | pgTAP: code shape, expiry, reuse, cross-family denial, membership creation |
| `src/features/family/inviteQueries.ts` | invite data layer + TanStack hooks |
| `src/features/family/__tests__/inviteQueries.test.ts` | unit tests for the above |
| `src/features/family/InvitePanel.tsx` | Family-screen invite surface (create, show code, copy, revoke) |
| `src/app/(app)/join.tsx` | accept-an-invite screen, reachable by code or link |
| `src/features/family/exportBundle.ts` | pure builder: rows in, export JSON out |
| `src/features/family/__tests__/exportBundle.test.ts` | unit tests for the JSON shape |
| `src/features/family/exportData.ts` | fetch + zip + hand to the share sheet |
| `supabase/functions/delete-account/index.ts` | Edge Function: storage objects, family rows, auth user |
| `src/features/family/deleteAccount.ts` | client call + session teardown |
| `src/app/(app)/family.tsx` | wire in invite / export / delete; replace raw `Alert` |

---

### Task 1: Invite RPCs and the missing UPDATE policy (TDD with pgTAP)

An invitee cannot read `invites` (every policy is `is_family_member(family_id)`) and cannot insert into `family_members`. Both invite RPCs therefore run as `SECURITY DEFINER` with `search_path=''`, exactly like the shipped `create_family`.

**Files:**
- Create: `supabase/migrations/20260718000001_invites.sql`
- Create: `supabase/tests/0005_invites.test.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/0005_invites.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select has_function('public', 'create_invite', array['uuid'], 'create_invite(uuid) exists');
select has_function('public', 'accept_invite', array['text'], 'accept_invite(text) exists');

-- Two unrelated users: alice owns a family, bob is a stranger.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@theyjust.test'),
  ('22222222-2222-2222-2222-222222222222', 'bob@theyjust.test'),
  ('33333333-3333-3333-3333-333333333333', 'carol@theyjust.test');

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111"}';
select public.create_family('Alice family');

-- A code is minted for the inviter's own family.
select isnt(public.create_invite(
  (select family_id from public.family_members
    where user_id = '11111111-1111-1111-1111-111111111111')), null,
  'an owner can mint an invite for their family');

select is(
  (select length(code) from public.invites limit 1), 8,
  'the code is 8 characters');

select is(
  (select count(*) from public.invites where code ~ '^[A-Z0-9]{8}$'), 1::bigint,
  'the code is unambiguous uppercase alphanumerics');

-- A stranger cannot mint an invite for someone else's family.
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222"}';
select throws_ok(
  format('select public.create_invite(%L)',
    (select family_id from public.family_members
      where user_id = '11111111-1111-1111-1111-111111111111')),
  'P0001',
  'Not a member of that family',
  'a non-member cannot mint an invite for a family they are not in');

-- Bob accepts and becomes a member of Alice's family.
select is(
  public.accept_invite((select code from public.invites limit 1)),
  (select family_id from public.family_members
    where user_id = '11111111-1111-1111-1111-111111111111'),
  'accepting returns the inviter''s family id');

select is(
  (select count(*) from public.family_members
    where user_id = '22222222-2222-2222-2222-222222222222'), 1::bigint,
  'accepting created exactly one membership');

select is(
  (select role from public.family_members
    where user_id = '22222222-2222-2222-2222-222222222222'), 'parent',
  'an invited co-parent joins as parent, not owner');

-- The same code cannot be spent twice.
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333"}';
select throws_ok(
  format('select public.accept_invite(%L)', (select code from public.invites limit 1)),
  'P0001',
  'That invite has already been used',
  'a used code is refused');

-- An expired code is refused.
set local role postgres;
update public.invites set used_by = null, expires_at = now() - interval '1 day';
set local role authenticated;
select throws_ok(
  format('select public.accept_invite(%L)', (select code from public.invites limit 1)),
  'P0001',
  'That invite has expired',
  'an expired code is refused');

select throws_ok(
  'select public.accept_invite(''NOPE1234'')',
  'P0001',
  'That invite code is not valid',
  'an unknown code is refused');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
supabase test db
```

Expected: FAIL, `function public.create_invite(uuid) does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260718000001_invites.sql`:

```sql
-- Co-parent invites. Both RPCs are SECURITY DEFINER because the invitee is not
-- yet a family member: every invites policy is gated on is_family_member(), so
-- they cannot read their own invite, and they cannot insert into family_members
-- either. search_path='' so a caller cannot shadow our tables.

-- Crockford-style alphabet: no I, L, O, U, so a code read aloud over the phone
-- or typed by a tired parent cannot be misheard.
create or replace function public.generate_invite_code()
returns text
language sql
volatile
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTVWXYZ0123456789',
           (floor(random() * 32) + 1)::int, 1),
    '')
  from generate_series(1, 8);
$$;

create or replace function public.create_invite(p_family_id uuid)
returns public.invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_invite public.invites;
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;

  if not exists (
    select 1 from public.family_members
    where family_id = p_family_id and user_id = v_user
  ) then
    raise exception 'Not a member of that family';
  end if;

  -- Retry on the astronomically unlikely collision rather than fail the parent.
  loop
    v_code := public.generate_invite_code();
    exit when not exists (select 1 from public.invites where code = v_code);
  end loop;

  insert into public.invites (family_id, code, created_by, expires_at)
  values (p_family_id, v_code, v_user, now() + interval '7 days')
  returning * into v_invite;

  return v_invite;
end;
$$;

create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_invite public.invites;
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;

  select * into v_invite from public.invites
  where code = upper(trim(p_code));

  if v_invite is null then
    raise exception 'That invite code is not valid';
  end if;
  if v_invite.used_by is not null then
    raise exception 'That invite has already been used';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'That invite has expired';
  end if;

  -- Idempotent: re-accepting your own family is a no-op, not an error.
  if not exists (
    select 1 from public.family_members
    where family_id = v_invite.family_id and user_id = v_user
  ) then
    insert into public.family_members (family_id, user_id, role)
    values (v_invite.family_id, v_user, 'parent');
  end if;

  update public.invites set used_by = v_user where id = v_invite.id;

  return v_invite.family_id;
end;
$$;

revoke all on function public.create_invite(uuid) from public;
revoke all on function public.accept_invite(text) from public;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
supabase db reset && supabase test db
```

Expected: 5 files, all pass. `0005_invites.test.sql` reports 11 assertions.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260718000001_invites.sql supabase/tests/0005_invites.test.sql
git commit -m "feat(db): co-parent invite RPCs — mint, accept once, expire after 7 days"
```

---

### Task 2: Invite data layer (TDD)

**Files:**
- Create: `src/features/family/inviteQueries.ts`
- Test: `src/features/family/__tests__/inviteQueries.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/family/__tests__/inviteQueries.test.ts`:

```ts
import { acceptInvite, activeInvite, createInvite, revokeInvite } from '../inviteQueries';
import { supabase } from '../../../lib/supabase';

jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}));

const mockedRpc = supabase.rpc as jest.Mock;
const mockedFrom = supabase.from as jest.Mock;

afterEach(() => jest.clearAllMocks());

describe('createInvite', () => {
  it('calls the RPC with the family id and returns the invite', async () => {
    mockedRpc.mockResolvedValue({ data: { id: 'i1', code: 'ABCD1234' }, error: null });
    await expect(createInvite('fam-1')).resolves.toEqual({ id: 'i1', code: 'ABCD1234' });
    expect(mockedRpc).toHaveBeenCalledWith('create_invite', { p_family_id: 'fam-1' });
  });

  it('throws the database message so the screen can show it', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: { message: 'Not a member of that family' } });
    await expect(createInvite('fam-1')).rejects.toThrow('Not a member of that family');
  });
});

describe('acceptInvite', () => {
  it('upper-cases and trims the typed code before sending it', async () => {
    mockedRpc.mockResolvedValue({ data: 'fam-1', error: null });
    await expect(acceptInvite('  abcd1234 ')).resolves.toBe('fam-1');
    expect(mockedRpc).toHaveBeenCalledWith('accept_invite', { p_code: 'ABCD1234' });
  });

  it('surfaces a refused code', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: { message: 'That invite has expired' } });
    await expect(acceptInvite('ABCD1234')).rejects.toThrow('That invite has expired');
  });
});

describe('activeInvite', () => {
  it('returns the newest unused, unexpired invite or null', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const limit = jest.fn().mockReturnValue({ maybeSingle });
    const order = jest.fn().mockReturnValue({ limit });
    const gt = jest.fn().mockReturnValue({ order });
    const is = jest.fn().mockReturnValue({ gt });
    const eq = jest.fn().mockReturnValue({ is });
    const select = jest.fn().mockReturnValue({ eq });
    mockedFrom.mockReturnValue({ select });

    await expect(activeInvite('fam-1')).resolves.toBeNull();
    expect(mockedFrom).toHaveBeenCalledWith('invites');
    expect(eq).toHaveBeenCalledWith('family_id', 'fam-1');
    expect(is).toHaveBeenCalledWith('used_by', null);
  });
});

describe('revokeInvite', () => {
  it('deletes by id', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    mockedFrom.mockReturnValue({ delete: () => ({ eq }) });
    await revokeInvite('i1');
    expect(mockedFrom).toHaveBeenCalledWith('invites');
    expect(eq).toHaveBeenCalledWith('id', 'i1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- inviteQueries
```

Expected: FAIL, `Cannot find module '../inviteQueries'`.

- [ ] **Step 3: Implement `src/features/family/inviteQueries.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export type Invite = {
  id: string;
  family_id: string;
  code: string;
  created_by: string;
  expires_at: string;
  used_by: string | null;
};

export async function createInvite(familyId: string): Promise<Invite> {
  const { data, error } = await supabase.rpc('create_invite', { p_family_id: familyId });
  if (error) throw new Error(error.message);
  return data as Invite;
}

// The code is typed by a tired parent off a phone screen, so normalise it here
// rather than making them match our casing.
export async function acceptInvite(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_invite', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function activeInvite(familyId: string): Promise<Invite | null> {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('family_id', familyId)
    .is('used_by', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Invite) ?? null;
}

export async function revokeInvite(id: string): Promise<void> {
  const { error } = await supabase.from('invites').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export function useActiveInvite(familyId: string | null) {
  return useQuery({
    queryKey: ['invite', familyId],
    queryFn: () => activeInvite(familyId as string),
    enabled: familyId !== null,
  });
}

export function useCreateInvite(familyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => createInvite(familyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invite', familyId] }),
  });
}

export function useRevokeInvite(familyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeInvite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invite', familyId] }),
  });
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm test -- inviteQueries && npx tsc --noEmit
```

Expected: 6 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/family/inviteQueries.ts src/features/family/__tests__/inviteQueries.test.ts
git commit -m "feat: invite data layer — mint, list active, accept, revoke"
```

---

### Task 3: InvitePanel (TDD)

A quiet block on the Family screen: a button to mint a code, then the code shown large enough to read aloud, with copy and revoke.

**Files:**
- Create: `src/features/family/InvitePanel.tsx`
- Test: `src/features/family/__tests__/InvitePanel.test.tsx`

- [ ] **Step 1: Install the clipboard module**

```bash
npx expo install expo-clipboard
```

- [ ] **Step 2: Write the failing tests**

Create `src/features/family/__tests__/InvitePanel.test.tsx`:

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import { InvitePanel } from '../InvitePanel';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

describe('InvitePanel', () => {
  it('invites a co-parent when there is no active code', async () => {
    const onCreate = jest.fn();
    const user = userEvent.setup();
    await render(
      <InvitePanel invite={null} busy={false} onCreate={onCreate} onRevoke={jest.fn()} />,
    );

    expect(screen.getByText('Invite a co-parent')).toBeTruthy();
    await user.press(screen.getByText('Create an invite code'));
    expect(onCreate).toHaveBeenCalled();
  });

  it('shows an active code with its expiry, and can revoke it', async () => {
    const onRevoke = jest.fn();
    const user = userEvent.setup();
    await render(
      <InvitePanel
        invite={{
          id: 'i1',
          family_id: 'f1',
          code: 'ABCD1234',
          created_by: 'u1',
          expires_at: '2026-07-25T00:00:00.000Z',
          used_by: null,
        }}
        busy={false}
        onCreate={jest.fn()}
        onRevoke={onRevoke}
      />,
    );

    expect(screen.getByText('ABCD1234')).toBeTruthy();
    expect(screen.getByText('Expires 25 July 2026')).toBeTruthy();
    await user.press(screen.getByText('Revoke'));
    expect(onRevoke).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
npm test -- InvitePanel
```

Expected: FAIL, `Cannot find module '../InvitePanel'`.

- [ ] **Step 4: Implement `src/features/family/InvitePanel.tsx`**

```tsx
import * as Clipboard from 'expo-clipboard';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextButton } from '@/components/TextButton';
import { formatDisplayDate } from '@/lib/date';
import { notify } from '@/lib/dialog';
import { color, font, radius, space, type } from '@/theme/tokens';
import type { Invite } from './inviteQueries';

type Props = {
  invite: Invite | null;
  busy: boolean;
  onCreate: () => void;
  onRevoke: () => void;
};

export function InvitePanel({ invite, busy, onCreate, onRevoke }: Props) {
  const copy = async () => {
    if (!invite) return;
    await Clipboard.setStringAsync(invite.code);
    notify('Code copied', 'Send it to your co-parent however you like.');
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Invite a co-parent</Text>
      {invite ? (
        <>
          <Text style={styles.blurb}>
            They enter this code after signing up, and your family appears on their phone.
          </Text>
          <Text style={styles.code} accessibilityLabel={`Invite code ${invite.code.split('').join(' ')}`}>
            {invite.code}
          </Text>
          <Text style={styles.expiry}>
            {`Expires ${formatDisplayDate(invite.expires_at.slice(0, 10))}`}
          </Text>
          <View style={styles.actions}>
            <TextButton label="Copy code" onPress={copy} />
            <TextButton label="Revoke" onPress={onRevoke} tone="muted" />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.blurb}>
            One code, good for seven days, lets one other parent into this family.
          </Text>
          <PrimaryButton label="Create an invite code" onPress={onCreate} busy={busy} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, paddingVertical: space.lg },
  heading: { fontFamily: font.display, fontSize: type.title, color: color.ink },
  blurb: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted, lineHeight: 21 },
  // Big, spaced and monospaced-by-tracking so it can be read down a phone line.
  code: {
    fontFamily: font.bold,
    fontSize: type.hero,
    color: color.damson,
    letterSpacing: 4,
    backgroundColor: color.damsonSoft,
    borderRadius: radius.md,
    paddingVertical: space.md,
    textAlign: 'center',
    marginTop: space.xs,
  },
  expiry: { fontFamily: font.body, fontSize: type.caption, color: color.inkMuted },
  actions: { flexDirection: 'row', gap: space.xl, marginTop: space.xs },
});
```

- [ ] **Step 5: Run to verify they pass**

```bash
npm test -- InvitePanel && npx tsc --noEmit
```

Expected: 2 passed; tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/features/family/InvitePanel.tsx src/features/family/__tests__/InvitePanel.test.tsx package.json package-lock.json
git commit -m "feat: invite panel — mint a code, read it aloud, copy or revoke"
```

---

### Task 4: Join-by-code screen

**Files:**
- Create: `src/app/(app)/join.tsx`
- Modify: `src/app/(app)/_layout.tsx` (register the route as tab-hidden)

- [ ] **Step 1: Create `src/app/(app)/join.tsx`**

```tsx
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Field } from '@/components/Field';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextButton } from '@/components/TextButton';
import { acceptInvite } from '@/features/family/inviteQueries';
import { notify } from '@/lib/dialog';
import { color, font, space, type } from '@/theme/tokens';

export default function JoinScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  // A shared link can carry the code: /join?code=ABCD1234
  const { code: linkCode } = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(linkCode ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (code.trim().length !== 8) {
      setError('An invite code is 8 characters');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await acceptInvite(code);
      // Everything about who you are just changed: drop every cached family view.
      await qc.invalidateQueries();
      notify('You are in', 'Their story is on your Timeline now.');
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code did not work.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Join a family</Text>
        <TextButton label="Cancel" onPress={() => router.back()} tone="muted" />
      </View>
      <Text style={styles.blurb}>
        Enter the code the other parent sent you. It works once, and only for seven days.
      </Text>
      <Field
        label="Invite code"
        placeholder="ABCD1234"
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={setCode}
      />
      {error ? (
        <Text style={styles.error} role="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <PrimaryButton label="Join the family" onPress={submit} busy={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { padding: space.lg, gap: space.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screenTitle: { fontFamily: font.medium, fontSize: type.label, color: color.inkMuted },
  blurb: { fontFamily: font.body, fontSize: type.body, color: color.inkMuted, lineHeight: 22 },
  error: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
});
```

- [ ] **Step 2: Register the route.** In `src/app/(app)/_layout.tsx`, add one line beside the other hidden screens:

```tsx
        <Tabs.Screen name="capture" options={{ href: null }} />
        <Tabs.Screen name="moment/[id]" options={{ href: null }} />
        <Tabs.Screen name="join" options={{ href: null }} />
```

- [ ] **Step 3: Verify**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test
```

Expected: tsc exit 0; full suite green (no new tests here; the screen is verified at runtime in Task 11).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/join.tsx" "src/app/(app)/_layout.tsx"
git commit -m "feat: join-a-family screen, by typed code or shared link"
```

---

### Task 5: Export bundle builder (TDD)

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

Expected: 5 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/family/exportBundle.ts src/features/family/__tests__/exportBundle.test.ts
git commit -m "feat: export bundle builder — the parent's book, not our schema"
```

---

### Task 6: Zip the export and hand it to the share sheet

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
import { supabase } from '../../lib/supabase';
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
  zip.file('theyjust-export.json', JSON.stringify(buildExportBundle(exportedAt, children, moments), null, 2));

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

/** Exposed so the settings row can warn before a very large export. */
export async function countPhotos(): Promise<number> {
  const { count, error } = await supabase
    .from('moment_photos')
    .select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}
```

- [ ] **Step 3: Verify**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test
```

Expected: tsc exit 0; full suite green. No unit test here: the module is a thin shell over the network, the filesystem and the share sheet, and its one piece of real logic (the bundle shape) is already covered by Task 5. It is exercised for real in Task 11.

- [ ] **Step 4: Commit**

```bash
git add src/features/family/exportData.ts package.json package-lock.json
git commit -m "feat: export everything as a zip — JSON plus the photos, shared or downloaded"
```

---

### Task 7: Account-deletion Edge Function

The first Edge Function in the project. It exists because two things are impossible from the client: deleting a row from `auth.users`, and deleting a storage object (a `storage.protect_delete()` trigger blocks SQL deletes, so it must go through the Storage API).

**Co-parent safety matters here.** A shared family must not be destroyed because one parent leaves. The function deletes a family only when the leaving parent is its last member; otherwise it just removes their membership.

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

  // Families this user belongs to, and whether anyone else is left in them.
  const { data: memberships } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId);

  const familyIds = (memberships ?? []).map((m) => m.family_id as string);
  const soleOwned: string[] = [];
  for (const familyId of familyIds) {
    const { count } = await admin
      .from('family_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('family_id', familyId);
    if ((count ?? 0) <= 1) soleOwned.push(familyId);
  }

  // Photos belong to moments belonging to children of the families being removed.
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

  // Shared families survive; this parent simply leaves them.
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

- [ ] **Step 2: Serve it locally and check it rejects an anonymous caller**

```bash
supabase functions serve delete-account --no-verify-jwt &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:54321/functions/v1/delete-account
```

Expected: `401` (no Authorization header, so no caller can be established).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/delete-account/index.ts
git commit -m "feat(edge): delete-account — storage, sole-owned families, memberships, auth user"
```

---

### Task 8: Delete-account client (TDD)

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

### Task 9: Wire it all into the Family screen

Also fixes a live bug: `family.tsx` still calls `Alert.alert` directly for the sign-out confirm, which is a no-op on react-native-web, so that confirm never appears there.

**Files:**
- Modify: `src/app/(app)/family.tsx`

- [ ] **Step 1: Replace the raw Alert import.** Change the `react-native` import line so `Alert` is dropped, and add the dialog helper beside the other `@/lib` imports:

```tsx
import { confirmDestructive, notify } from '@/lib/dialog';
```

- [ ] **Step 2: Replace the sign-out confirm.** Swap the `Alert.alert('Sign out?', ...)` call for:

```tsx
  const confirmSignOut = () =>
    confirmDestructive('Sign out?', 'You can sign back in any time.', 'Sign out', () => {
      void supabase.auth.signOut();
    });
```

- [ ] **Step 3: Add the invite, export and deletion surfaces.** Add these imports:

```tsx
import { InvitePanel } from '@/features/family/InvitePanel';
import { useActiveInvite, useCreateInvite, useRevokeInvite } from '@/features/family/inviteQueries';
import { exportEverything } from '@/features/family/exportData';
import { deleteAccount } from '@/features/family/deleteAccount';
```

Inside the component, beside the existing hooks:

```tsx
  const familyId = children[0]?.family_id ?? null;
  const { data: invite } = useActiveInvite(familyId);
  const createInvite = useCreateInvite(familyId ?? '');
  const revokeInvite = useRevokeInvite(familyId ?? '');
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
      'Your moments and photos are erased for good. A family you share stays with the other parent.',
      'Delete',
      () => {
        deleteAccount().catch((e) =>
          notify('Could not delete', e instanceof Error ? e.message : 'Please try again.'),
        );
      },
    );
```

And render them after the child list, before Sign out:

```tsx
        {familyId ? (
          <InvitePanel
            invite={invite ?? null}
            busy={createInvite.isPending}
            onCreate={() => createInvite.mutate()}
            onRevoke={() => invite && revokeInvite.mutate(invite.id)}
          />
        ) : null}
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

Add the two styles beside the existing ones:

```tsx
  section: { gap: space.sm, paddingVertical: space.lg, ...hairline },
  blurb: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted, lineHeight: 21 },
```

`hairline` comes from `@/theme/tokens`; add it to that import if it is not there already.

- [ ] **Step 4: Verify**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test
```

Expected: tsc exit 0; full suite green. Confirm no bare `Alert` remains:

```bash
grep -n "Alert" "src/app/(app)/family.tsx"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/family.tsx"
git commit -m "feat: family screen gains invites, export and account deletion; sign-out confirm now works on web"
```

---

### Task 10: Make the pgTAP family-count assertion robust

`0003_create_family.test.sql` asserts `count(*) = 2` over the whole table, so the suite fails locally as soon as the development database holds real families. CI passes only because it starts empty. Assert the delta instead.

**Files:**
- Modify: `supabase/tests/0003_create_family.test.sql`

- [ ] **Step 1: Replace the absolute count.** Change the final assertion from:

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

- [ ] **Step 2: Verify it passes against a dirty database**

```bash
supabase test db
```

Expected: 5 files pass, without needing `supabase db reset` first.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/0003_create_family.test.sql
git commit -m "test(db): assert the created-family delta, not an absolute table count"
```

---

### Task 11: Full gates and runtime verification

**Files:** none new.

- [ ] **Step 1: Full local gates**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test && supabase db reset && supabase test db
```

Expected: tsc exit 0; Jest green; pgTAP 5 files pass.

- [ ] **Step 2: Web export smoke check**

```bash
npx expo export --platform web 2>&1 | tail -3 && rm -rf dist
```

Expected: exit 0.

- [ ] **Step 3: Runtime verification.** The coordinator drives the browser against local Supabase:

1. **Invite round trip.** Sign in as parent A, Family tab, create an invite code. Sign out, sign up as parent B, open `/join`, enter the code. Parent B lands on the Timeline showing parent A's child and moments. Confirm in the database that `family_members` has two rows for that family and the invite's `used_by` is set.
2. **Invite cannot be reused.** Sign up as parent C and try the same code: the screen shows "That invite has already been used".
3. **Export.** As parent A, Family tab, Export everything. On web a zip downloads. Open it: `theyjust-export.json` has the children and their moments with celebration titles, and `photos/` holds the image files.
4. **Deletion protects a shared family.** As parent B (a co-parent, not the last member), delete the account. Confirm parent A still has the family, children, moments and photos, and that parent B's `auth.users` row and membership are gone.
5. **Deletion of a sole-owned family.** As a parent who is the only member, delete the account. Confirm the family, children, moments, `moment_photos` rows and the storage objects are all gone.

Watch the console throughout. Storage emptiness is the one thing easy to get wrong, so check it in SQL, not by eye.

---

## Self-review

**Spec coverage.** §3 data model: the `invites` table already existed and is now driven by Tasks 1-4. §4.5 Family & settings: invite co-parent (Task 3, 9), data export (Tasks 5, 6, 9), account deletion (Tasks 7, 8, 9). §6 privacy: JSON + photo export (Tasks 5, 6), cascade deletion including storage objects (Task 7), children's data never leaves the family's RLS boundary (export reads with the parent's own session). §9 phases: session encryption, production auth config and OAuth are explicitly deferred to Plan 5 and named in Scope.

**Gaps I am accepting, and why.** Export holds the whole zip in memory, which is fine for a first-year timeline but would strain on thousands of photos; `countPhotos` exists so a future task can warn first. The Edge Function has no automated test because there is no Deno test harness in this repo yet; Task 11 steps 4 and 5 verify both of its branches by hand, and the sole-owned-versus-shared distinction is the part that matters.

**Type consistency.** `Invite` is defined in Task 2 and consumed in Tasks 3 and 9. `buildExportBundle(exportedAt, children, moments)` and `photoFileName(storagePath)` are defined in Task 5 and used in Task 6. `deleteAccount()` is defined in Task 8 and called in Task 9. `Child` and `Moment` are imported from the shipped `children/queries` and `moments/momentQueries`. `notify` and `confirmDestructive` match the shipped `src/lib/dialog.ts` signatures, and `formatDisplayDate` matches `src/lib/date.ts`.
