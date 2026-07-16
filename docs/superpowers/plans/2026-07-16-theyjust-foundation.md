# TheyJust Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Expo app you can sign into, backed by a Supabase schema whose family-scoping security (RLS) is proven by automated tests.

**Architecture:** Expo (React Native, TypeScript, Expo Router) app talking directly to Supabase (Postgres + RLS, Auth, local via Supabase CLI/Docker for dev). No custom server. Database security is the foundation everything else builds on, so it comes first and is test-driven with pgTAP.

**Tech Stack:** Expo SDK (latest), TypeScript, Expo Router, Jest (jest-expo), React Native Testing Library, @supabase/supabase-js v2, Supabase CLI, pgTAP for database tests, GitHub Actions CI.

**Spec:** `docs/superpowers/specs/2026-07-16-theyjust-milestone-tracker-design.md`
**This is Plan 1 of 4.** Later plans: (2) children & milestone catalogue, (3) moments & photos, (4) invites, export, deletion, social sign-in. Email/password auth only in this plan; Sign in with Apple/Google is Plan 4 (needed before store release, not before development).

**Prerequisites (install before starting):**
- Node 20+ (`node --version`)
- Docker Desktop running (required by Supabase CLI local stack)
- Supabase CLI: `brew install supabase/tap/supabase`
- iOS Simulator (Xcode) or the Expo Go app on a phone

---

### Task 1: Scaffold the Expo app

**Files:**
- Create: entire Expo template (`package.json`, `app/`, `tsconfig.json`, `.gitignore`, …) in repo root

- [ ] **Step 1: Scaffold**

Run from `/Users/jonathanpye-finch/theyjust`:

```bash
npx create-expo-app@latest .
```

If it refuses because the directory is non-empty (it contains `docs/` and `.git/`), scaffold to a temp dir and move the files in:

```bash
npx create-expo-app@latest /tmp/theyjust-scaffold
rsync -a --ignore-existing /tmp/theyjust-scaffold/ ./
rm -rf /tmp/theyjust-scaffold
npm install
```

- [ ] **Step 2: Strip the example screens**

The default template ships demo screens plus a script that removes them:

```bash
npm run reset-project
rm -rf app-example
```

(If the template version has no `reset-project` script, delete the demo content of `app/` manually, leaving `app/_layout.tsx` and `app/index.tsx`.)

- [ ] **Step 3: Verify it typechecks and boots**

```bash
npx tsc --noEmit
```

Expected: exits 0, no output.

```bash
npx expo start
```

Expected: QR code + dev server. Press `i` to confirm the blank app opens in the iOS simulator, then Ctrl-C.

- [ ] **Step 4: Add `.env` to .gitignore**

Append to `.gitignore`:

```
.env
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo app (TypeScript, Expo Router)"
```

---

### Task 2: Jest setup with a sanity test

**Files:**
- Modify: `package.json`
- Create: `src/lib/__tests__/sanity.test.ts`

- [ ] **Step 1: Install test dependencies**

```bash
npx expo install -- --save-dev jest-expo jest @types/jest @testing-library/react-native
```

- [ ] **Step 2: Configure Jest in `package.json`**

Add these top-level keys (merge into existing JSON):

```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@supabase))",
      "/node_modules/react-native-reanimated/plugin/",
      "/node_modules/@react-native/babel-preset/"
    ]
  }
```

(This is the jest-expo 57 preset's own three-entry array with an added `@supabase` carve-out — overriding `transformIgnorePatterns` replaces the preset's value wholesale, so all three entries must be preserved.)

```json
}
```

- [ ] **Step 3: Write the sanity test**

Create `src/lib/__tests__/sanity.test.ts`:

```ts
describe('jest setup', () => {
  it('runs TypeScript tests', () => {
    const answer: number = 42;
    expect(answer).toBe(42);
  });
});
```

- [ ] **Step 4: Run it**

```bash
npm test
```

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add Jest via jest-expo with sanity test"
```

---

### Task 3: Local Supabase + app client

**Files:**
- Create: `supabase/config.toml` (generated), `.env`, `src/lib/supabase.ts`

- [ ] **Step 1: Initialise and start local Supabase**

```bash
supabase init
supabase start
```

Expected: `supabase start` prints a block including `API URL: http://127.0.0.1:54321` and `anon key: eyJ...`. (First run downloads Docker images — slow.)

- [ ] **Step 2: Create `.env` (gitignored) with those values**

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start output>
```

Note: on a physical phone via Expo Go, `127.0.0.1` won't reach your Mac — use the simulator for this plan, or substitute your Mac's LAN IP.

- [ ] **Step 3: Install client dependencies**

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

- [ ] **Step 4: Create `src/lib/supabase.ts`**

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY — copy them from `supabase start` into .env',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 5: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: exits 0.

Known trap: if a later Jest test importing supabase-js fails with `Cannot use import statement outside a module`, the culprit is usually `isows` (an ESM dep of @supabase/realtime-js, outside the `@supabase/` scope) — add `isows` to the first transformIgnorePatterns lookahead alternatives.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: local Supabase stack and app client"
```

---

### Task 4: Database schema (TDD with pgTAP)

**Files:**
- Create: `supabase/tests/0001_schema.test.sql`
- Create: `supabase/migrations/20260716000001_schema.sql`

- [ ] **Step 1: Write the failing schema test**

Create `supabase/tests/0001_schema.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select has_table('public', 'families', 'families table exists');
select has_table('public', 'family_members', 'family_members table exists');
select has_table('public', 'children', 'children table exists');
select has_table('public', 'moments', 'moments table exists');
select has_table('public', 'moment_photos', 'moment_photos table exists');
select has_table('public', 'invites', 'invites table exists');

select has_column('public', 'moment_photos', 'storage_path', 'moment_photos.storage_path exists');
select has_column('public', 'moment_photos', 'position', 'moment_photos.position exists');
select has_column('public', 'invites', 'code', 'invites.code exists');
select has_column('public', 'invites', 'expires_at', 'invites.expires_at exists');

-- Seed enough rows to exercise the moments XOR constraint (superuser bypasses RLS).
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000000a', 'seed@test.local');
insert into public.families (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000f1', 'Testers', '00000000-0000-0000-0000-00000000000a');
insert into public.children (id, family_id, name, date_of_birth)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'Test Baby', '2026-01-01');

select lives_ok(
  $$insert into public.moments (child_id, milestone_id, occurred_on, logged_by)
    values ('00000000-0000-0000-0000-0000000000c1', 'rolled_over', '2026-05-01',
            '00000000-0000-0000-0000-00000000000a')$$,
  'catalogue moment (milestone_id only) is valid');

select lives_ok(
  $$insert into public.moments (child_id, custom_title, occurred_on, logged_by)
    values ('00000000-0000-0000-0000-0000000000c1', 'First haircut', '2026-06-01',
            '00000000-0000-0000-0000-00000000000a')$$,
  'custom moment (custom_title only) is valid');

select throws_ok(
  $$insert into public.moments (child_id, milestone_id, custom_title, occurred_on, logged_by)
    values ('00000000-0000-0000-0000-0000000000c1', 'rolled_over', 'Also custom', '2026-06-01',
            '00000000-0000-0000-0000-00000000000a')$$,
  '23514',
  null,
  'moment with BOTH milestone_id and custom_title violates XOR constraint');

select throws_ok(
  $$insert into public.moments (child_id, occurred_on, logged_by)
    values ('00000000-0000-0000-0000-0000000000c1', '2026-06-01',
            '00000000-0000-0000-0000-00000000000a')$$,
  '23514',
  null,
  'moment with NEITHER milestone_id nor custom_title violates XOR constraint');

select * from finish();
rollback;
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
supabase db reset && supabase test db
```

Expected: FAIL — `has_table` assertions fail (tables don't exist yet).

- [ ] **Step 3: Write the schema migration**

Create `supabase/migrations/20260716000001_schema.sql`:

```sql
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My family',
  -- informational; ownership lives in family_members. Nullable + set null so
  -- account deletion (spec §6) can sever the reference without destroying the family.
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'parent')),
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null,
  date_of_birth date not null,
  due_date date,           -- non-null marks premature birth; drives corrected age
  avatar_path text,
  created_at timestamptz not null default now(),
  constraint due_after_birth check (due_date is null or due_date > date_of_birth)
);

create table public.moments (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  milestone_id text,       -- catalogue id (app-bundled JSON), XOR custom_title
  custom_title text,
  occurred_on date not null,
  note text,
  -- attribution survives account deletion (spec §6): set null, UI shows a fallback
  logged_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint moment_kind check (
    (milestone_id is not null and custom_title is null)
    or (milestone_id is null and custom_title is not null)
  ),
  constraint milestone_id_not_blank check
    (milestone_id is null or length(trim(milestone_id)) > 0),
  constraint custom_title_not_blank check
    (custom_title is null or length(trim(custom_title)) > 0)
);

create table public.moment_photos (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments (id) on delete cascade,
  storage_path text not null,
  width int,
  height int,
  position int not null default 0
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  code text not null unique,
  -- invites are ephemeral: cascade with their creator; redemption marker survives as null
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_by uuid references auth.users (id) on delete set null
);

create index moments_child_occurred_idx on public.moments (child_id, occurred_on desc);
create index moment_photos_moment_idx on public.moment_photos (moment_id, position);
create index children_family_idx on public.children (family_id);
create index family_members_user_idx on public.family_members (user_id);
create index invites_family_idx on public.invites (family_id);

-- RLS is enabled from birth so these tables are default-deny even before the
-- Task 5 policies exist. postgres/superuser bypasses RLS, so migrations and
-- pgTAP seeds are unaffected.
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.children enable row level security;
alter table public.moments enable row level security;
alter table public.moment_photos enable row level security;
alter table public.invites enable row level security;

-- The Supabase CLI no longer auto-grants privileges on new tables to the API
-- roles, so without explicit grants `authenticated` (the app) and
-- `service_role` (edge functions / future admin flows) hit "permission denied"
-- before RLS is consulted. RLS + policies remain the security boundary.
grant select, insert, update, delete
  on public.family_members, public.children,
     public.moment_photos, public.invites
  to authenticated, service_role;

-- moments: authenticated update is column-scoped so attribution (logged_by)
-- and lineage (id, child_id, created_at) can't be rewritten after logging.
grant select, insert, delete on public.moments to authenticated, service_role;
grant update (milestone_id, custom_title, occurred_on, note)
  on public.moments to authenticated;
grant update on public.moments to service_role;

-- families: likewise column-scoped — members may edit only the display name.
-- created_by is provenance and must not be spoofable (Plan 4 builds
-- ownership transfer on top of trustworthy membership/provenance data).
grant select, insert, delete on public.families to authenticated, service_role;
grant update (name) on public.families to authenticated;
grant update on public.families to service_role;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
supabase db reset && supabase test db
```

Expected: `Files=1, Tests=14`, all pass.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat: core schema with moment XOR constraint (pgTAP-tested)"
```

---

### Task 5: Row-Level Security (TDD with pgTAP)

The single most important property in the product: **a user can only touch rows belonging to their own family.**

**Files:**
- Create: `supabase/tests/0002_rls.test.sql`
- Create: `supabase/migrations/20260716000002_rls.sql`

- [ ] **Step 1: Write the failing RLS test**

Create `supabase/tests/0002_rls.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Seed (as superuser, bypassing RLS): two users, two families, one child each.
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
  ('00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-0000000000fa', 'Alice Jr', '2026-01-01'),
  ('00000000-0000-0000-0000-0000000000cb', '00000000-0000-0000-0000-0000000000fb', 'Bob Jr',   '2026-02-01');

insert into public.moments (id, child_id, milestone_id, occurred_on, logged_by) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000ca',
   'first_smile', '2026-03-01', '00000000-0000-0000-0000-0000000000a1');

insert into public.moment_photos (id, moment_id, storage_path) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1',
   'family-fa/photo-1.jpg');

insert into public.invites (family_id, code, created_by, expires_at) values
  ('00000000-0000-0000-0000-0000000000fa', 'ALICE-INVITE',
   '00000000-0000-0000-0000-0000000000a1', now() + interval '7 days');

-- Become Alice.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);

select is((select count(*) from public.families), 1::bigint,
  'Alice sees exactly her own family');
select is((select count(*) from public.children), 1::bigint,
  'Alice sees exactly her own child');
select is((select name from public.children), 'Alice Jr',
  'and it is the right child');
select is((select count(*) from public.moments), 1::bigint,
  'Alice sees her own moment');
select is((select count(*) from public.moment_photos), 1::bigint,
  'Alice sees her moment''s photo');

select throws_ok(
  $$insert into public.children (family_id, name, date_of_birth)
    values ('00000000-0000-0000-0000-0000000000fb', 'Intruder', '2026-01-01')$$,
  '42501', null,
  'Alice cannot insert a child into Bob''s family');

-- Become Bob.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}', true);

select is((select count(*) from public.moments), 0::bigint,
  'Bob sees none of Alice''s moments');
select is((select count(*) from public.moment_photos), 0::bigint,
  'Bob sees no photos from Alice''s family');

select lives_ok(
  $$insert into public.children (family_id, name, date_of_birth)
    values ('00000000-0000-0000-0000-0000000000fb', 'Bob Jr 2', '2026-03-01')$$,
  'Bob CAN insert a child into his own family');

-- Bob cannot MUTATE Alice's rows (RLS filters silently: 0 rows affected).
with u as (update public.moments set note = 'hacked'
           where id = '00000000-0000-0000-0000-0000000000d1' returning 1)
select is((select count(*) from u), 0::bigint,
  'Bob cannot update Alice''s moment');

with d as (delete from public.moments
           where id = '00000000-0000-0000-0000-0000000000d1' returning 1)
select is((select count(*) from d), 0::bigint,
  'Bob cannot delete Alice''s moment');

with u as (update public.children set name = 'hacked'
           where id = '00000000-0000-0000-0000-0000000000ca' returning 1)
select is((select count(*) from u), 0::bigint,
  'Bob cannot update Alice''s child');

with d as (delete from public.children
           where id = '00000000-0000-0000-0000-0000000000ca' returning 1)
select is((select count(*) from d), 0::bigint,
  'Bob cannot delete Alice''s child');

with u as (update public.families set name = 'hacked'
           where id = '00000000-0000-0000-0000-0000000000fa' returning 1)
select is((select count(*) from u), 0::bigint,
  'Bob cannot rename Alice''s family');

select throws_ok(
  $$insert into public.moment_photos (moment_id, storage_path)
    values ('00000000-0000-0000-0000-0000000000d1', 'intruder.jpg')$$,
  '42501', null,
  'Bob cannot attach a photo to Alice''s moment');

with d as (delete from public.moment_photos
           where id = '00000000-0000-0000-0000-0000000000e1' returning 1)
select is((select count(*) from d), 0::bigint,
  'Bob cannot delete Alice''s photo');

select is((select count(*) from public.invites), 0::bigint,
  'Bob sees none of Alice''s invites');

-- Back to Alice: positive controls prove the write paths actually work.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);

with u as (update public.moments set note = 'Her first smile!'
           where id = '00000000-0000-0000-0000-0000000000d1' returning 1)
select is((select count(*) from u), 1::bigint,
  'Alice can update her own moment');

with u as (update public.families set name = 'The Alices'
           where id = '00000000-0000-0000-0000-0000000000fa' returning 1)
select is((select count(*) from u), 1::bigint,
  'Alice can rename her own family');

select throws_ok(
  $$update public.families set created_by = '00000000-0000-0000-0000-0000000000b1'
    where id = '00000000-0000-0000-0000-0000000000fa'$$,
  '42501', null,
  'created_by is not writable even by a family member (column-scoped grant)');

select * from finish();
rollback;
```

(Why the odd top-level `with … select is(…)` shape: Postgres requires data-modifying
CTEs at the statement's top level — they cannot be nested inside `is()`'s scalar
subquery. `ERROR: WITH clause containing a data-modifying statement must be at the top level`.)

- [ ] **Step 2: Run tests to verify they fail**

```bash
supabase db reset && supabase test db
```

Expected: FAIL — RLS is enabled (schema migration) but no policies exist yet, so default-deny hides every row: the is() count assertions fail (0 rows instead of 1), Alice's positive-control updates affect 0 rows, and the lives_ok ("Bob CAN insert") fails with 42501. The denial assertions (throws_ok / 0-rows-affected) pass early — the counts and positive controls are the TDD signal.

- [ ] **Step 3: Write the RLS migration**

Create `supabase/migrations/20260716000002_rls.sql`:

```sql
-- Membership helper. SECURITY DEFINER so policies on family_members itself
-- don't recurse; search_path pinned per Supabase security guidance.
create or replace function public.is_family_member(fam uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.family_members
    where family_id = fam and user_id = auth.uid()
  );
$$;

create or replace function public.can_access_child(c uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.children ch
    join public.family_members fm on fm.family_id = ch.family_id
    where ch.id = c and fm.user_id = auth.uid()
  );
$$;

create or replace function public.can_access_moment(m uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.moments mo
    where mo.id = m and public.can_access_child(mo.child_id)
  );
$$;

-- RLS was already enabled for all six tables in the schema migration (Task 4).

-- Supabase's default ACLs grant TRUNCATE (not subject to RLS) to the API roles
-- on new tables. PostgREST never exposes TRUNCATE, but revoke it anyway so no
-- future invoker-rights SQL path can wipe a table.
revoke truncate on all tables in schema public from anon, authenticated;
-- …and for tables created by future migrations (default ACLs re-grant otherwise):
alter default privileges in schema public
  revoke truncate on tables from anon, authenticated;

-- families: members read/update; creation only via create_family RPC (Task 6);
-- no direct insert/delete policy for now (owner-deletion flow is Plan 4).
create policy families_select on public.families
  for select using (public.is_family_member(id));
create policy families_update on public.families
  for update using (public.is_family_member(id));

-- family_members: members can see their family's roster. Row changes happen
-- via SECURITY DEFINER functions (create_family now, invite acceptance in Plan 4).
create policy family_members_select on public.family_members
  for select using (public.is_family_member(family_id));

-- children: full access within your family.
create policy children_select on public.children
  for select using (public.is_family_member(family_id));
create policy children_insert on public.children
  for insert with check (public.is_family_member(family_id));
create policy children_update on public.children
  for update using (public.is_family_member(family_id));
create policy children_delete on public.children
  for delete using (public.is_family_member(family_id));

-- moments: access via the child's family; logged_by must be the caller.
create policy moments_select on public.moments
  for select using (public.can_access_child(child_id));
create policy moments_insert on public.moments
  for insert with check (public.can_access_child(child_id) and logged_by = auth.uid());
create policy moments_update on public.moments
  for update using (public.can_access_child(child_id));
create policy moments_delete on public.moments
  for delete using (public.can_access_child(child_id));

-- moment_photos: access via the moment.
create policy moment_photos_select on public.moment_photos
  for select using (public.can_access_moment(moment_id));
create policy moment_photos_insert on public.moment_photos
  for insert with check (public.can_access_moment(moment_id));
create policy moment_photos_update on public.moment_photos
  for update using (public.can_access_moment(moment_id));
create policy moment_photos_delete on public.moment_photos
  for delete using (public.can_access_moment(moment_id));

-- invites: family members manage invites. Acceptance by an outsider is a
-- SECURITY DEFINER function in Plan 4 (an invitee can't see the row directly).
create policy invites_select on public.invites
  for select using (public.is_family_member(family_id));
create policy invites_insert on public.invites
  for insert with check (public.is_family_member(family_id) and created_by = auth.uid());
create policy invites_delete on public.invites
  for delete using (public.is_family_member(family_id));
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
supabase db reset && supabase test db
```

Expected: all pass (both test files, 34 assertions total).

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat: row-level security — family-scoped access proven by pgTAP tests"
```

Guardrail for Plans 2/3: Postgres applies RLS as a per-row post-filter, never as an
index condition. App queries must ALWAYS filter moments/photos by child_id/moment_id
(or an IN-list of the family's children) — an unfiltered `select * from moments`
scans every family's rows through the policy function and degrades as the system grows.

---

### Task 6: `create_family` RPC (TDD with pgTAP)

Bootstrap problem: a brand-new user belongs to no family, and RLS (correctly) blocks direct inserts into `families`/`family_members`. A SECURITY DEFINER function does both inserts atomically.

**Files:**
- Create: `supabase/tests/0003_create_family.test.sql`
- Create: `supabase/migrations/20260716000003_create_family.sql`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/0003_create_family.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'newparent@test.local'),
  ('00000000-0000-0000-0000-0000000000e2', 'otherparent@test.local');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated"}', true);

select lives_ok(
  $$select public.create_family('Pye-Finch family')$$,
  'a fresh user can create a family');

select is((select count(*) from public.families), 1::bigint,
  'the new family is visible to its creator');
select is((select name from public.families), 'Pye-Finch family',
  'with the requested name');
select is(
  (select role from public.family_members
   where user_id = '00000000-0000-0000-0000-0000000000e1'),
  'owner',
  'creator is enrolled as owner');

-- Idempotency: onboarding retries and double-taps must not fork the user
-- into a second family. This also asserts the RPC's return value is the
-- actual family id (the contract client code consumes).
select is(
  public.create_family('Second attempt'),
  (select id from public.families),
  'a repeat call returns the existing owned family''s id — no fork');
select is((select count(*) from public.families), 1::bigint,
  'and no second family was created');

-- A different user with a blank name gets the default.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000e2", "role": "authenticated"}', true);

select lives_ok(
  $$select public.create_family('   ')$$,
  'a fresh user can create a family with a blank name');
select is((select name from public.families), 'My family',
  'blank names fall back to the default');

-- Anonymous callers are rejected at the grant layer (fail closed): the
-- migration revokes EXECUTE from anon, so the call never reaches the body.
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select throws_ok(
  $$select public.create_family('Sneaky family')$$,
  '42501', null,
  'anonymous caller is rejected by the EXECUTE grant');

-- Defense in depth: an authenticated role with no user id (no sub claim)
-- passes the grant layer but is rejected by the body's auth.uid() check.
set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$select public.create_family('Sneaky family')$$,
  'P0001', 'not authenticated',
  'caller without a user id is rejected by the body check');

select * from finish();
rollback;
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
supabase db reset && supabase test db
```

Expected: FAIL — `function public.create_family(text) does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260716000003_create_family.sql`:

```sql
-- The only function end users call directly: bootstraps a brand-new account
-- past RLS (there is deliberately no insert policy on families/family_members).
-- Idempotent for onboarding: a retried or double-tapped call returns the
-- already-owned family instead of forking the user into a second one.
create or replace function public.create_family(family_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  fam_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Serialise concurrent calls from the same user (double-tap, network retry):
  -- without this, two READ COMMITTED transactions could both pass the
  -- already-owns-a-family check below and each create a family.
  perform pg_advisory_xact_lock(hashtext('create_family:' || auth.uid()::text));

  select family_id into fam_id
    from public.family_members
   where user_id = auth.uid() and role = 'owner'
   limit 1;
  if fam_id is not null then
    return fam_id;
  end if;

  insert into public.families (name, created_by)
  values (coalesce(nullif(trim(family_name), ''), 'My family'), auth.uid())
  returning id into fam_id;

  insert into public.family_members (family_id, user_id, role)
  values (fam_id, auth.uid(), 'owner');

  return fam_id;
end;
$$;

revoke execute on function public.create_family(text) from public, anon;
grant execute on function public.create_family(text) to authenticated;

-- Tidy-up from Task 5 review: the RLS helper functions default to EXECUTE for
-- PUBLIC. Inert for anon (auth.uid() is null → always false) but lock them to
-- the roles that need them anyway.
revoke execute on function public.is_family_member(uuid) from public, anon;
revoke execute on function public.can_access_child(uuid) from public, anon;
revoke execute on function public.can_access_moment(uuid) from public, anon;
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.can_access_child(uuid) to authenticated;
grant execute on function public.can_access_moment(uuid) to authenticated;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
supabase db reset && supabase test db
```

Expected: all pass (44 assertions across three files).

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat: create_family RPC solves the RLS bootstrap for new users"
```

---

### Task 7: Auth — session hook, sign-in/sign-up screens, route gate

**Files:**
- Create: `src/features/auth/useSession.ts`
- Create: `src/features/auth/AuthForm.tsx`
- Create: `src/app/_layout.tsx` (replace template version — SDK 57 keeps routes under `src/app/`)
- Create: `src/app/(auth)/sign-in.tsx`, `src/app/(auth)/sign-up.tsx`, `src/app/(auth)/_layout.tsx`
- Create: `src/app/(app)/index.tsx`, `src/app/(app)/_layout.tsx`
- Delete: `src/app/index.tsx` (template placeholder)
- Create: `jest.setup.js`, `.env.example`; modify `package.json` (jest setupFiles), `src/lib/supabase.ts` (AppState auto-refresh), `src/lib/__tests__/supabase-import.test.ts` (import real module)
- Test: `src/features/auth/__tests__/AuthForm.test.tsx`

- [ ] **Step 0: Jest env shim, .env.example, AppState auto-refresh**

Jest doesn't load `.env`, so importing `src/lib/supabase.ts` in any test would hit the module-level env guard and throw. Create `jest.setup.js`:

```js
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
```

Add to the `jest` block in `package.json`:

```json
"setupFiles": ["<rootDir>/jest.setup.js"]
```

Create `.env.example` (committed):

```
# Copy to .env and fill from `supabase start` output
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Append to `src/lib/supabase.ts` (documented Supabase RN pattern — pauses token refresh in background, resumes on foreground):

```ts
import { AppState } from 'react-native';

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
```

(Move the `AppState` import up with the other imports.) Then strengthen `src/lib/__tests__/supabase-import.test.ts` by adding a test that imports the real module, proving the env shim works:

```ts
import { supabase } from '../supabase';

it('constructs the app client under jest', () => {
  expect(supabase.auth).toBeDefined();
});
```

Run `npm test` — all suites pass.

- [ ] **Step 1: Write the failing component test**

Create `src/features/auth/__tests__/AuthForm.test.tsx`:

```tsx
import { render, fireEvent, screen } from '@testing-library/react-native';
import { AuthForm } from '../AuthForm';

describe('AuthForm', () => {
  it('submits trimmed email and password', () => {
    const onSubmit = jest.fn();
    render(<AuthForm submitLabel="Sign in" onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), '  jo@example.com ');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'hunter22');
    fireEvent.press(screen.getByText('Sign in'));

    expect(onSubmit).toHaveBeenCalledWith('jo@example.com', 'hunter22');
  });

  it('blocks submit and shows a message when fields are empty', () => {
    const onSubmit = jest.fn();
    render(<AuthForm submitLabel="Sign in" onSubmit={onSubmit} />);

    fireEvent.press(screen.getByText('Sign in'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter your email and password')).toBeTruthy();
  });

  it('shows the error passed in', () => {
    render(<AuthForm submitLabel="Sign in" onSubmit={jest.fn()} error="Invalid login credentials" />);
    expect(screen.getByText('Invalid login credentials')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- AuthForm
```

Expected: FAIL — `Cannot find module '../AuthForm'`.

- [ ] **Step 3: Implement `src/features/auth/AuthForm.tsx`**

```tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  submitLabel: string;
  onSubmit: (email: string, password: string) => void;
  error?: string | null;
  busy?: boolean;
};

export function AuthForm({ submitLabel, onSubmit, error, busy }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handlePress = () => {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setLocalError('Enter your email and password');
      return;
    }
    setLocalError(null);
    onSubmit(trimmed, password);
  };

  const message = error ?? localError;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />
      {message ? <Text style={styles.error}>{message}</Text> : null}
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

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- AuthForm
```

Expected: 3 passed.

- [ ] **Step 5: Create `src/features/auth/useSession.ts`**

```ts
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
}
```

- [ ] **Step 6: Root layout with auth gate — `src/app/_layout.tsx` (replace template file)**

```tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/features/auth/useSession';

export default function RootLayout() {
  const { session, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 7: Auth screens**

`src/app/(auth)/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`src/app/(auth)/sign-in.tsx`:

```tsx
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthForm } from '@/features/auth/AuthForm';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    setBusy(false);
    // On success the root layout's auth gate redirects automatically.
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>TheyJust</Text>
      <Text style={styles.subtitle}>Every first, remembered.</Text>
      <AuthForm submitLabel="Sign in" onSubmit={signIn} error={error} busy={busy} />
      <Link href="/(auth)/sign-up" style={styles.link}>
        New here? Create an account
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 34, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#666', marginBottom: 24 },
  link: { textAlign: 'center', marginTop: 16, color: '#1a1a2e' },
});
```

`src/app/(auth)/sign-up.tsx`:

```tsx
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthForm } from '@/features/auth/AuthForm';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signUp = async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signUp({ email, password });
    if (err) setError(err.message);
    setBusy(false);
    // Local dev has email confirmation disabled, so this signs the user
    // straight in and the auth gate redirects.
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Create account</Text>
      <AuthForm submitLabel="Sign up" onSubmit={signUp} error={error} busy={busy} />
      <Link href="/(auth)/sign-in" style={styles.link}>
        Already have an account? Sign in
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 24 },
  link: { textAlign: 'center', marginTop: 16, color: '#1a1a2e' },
});
```

- [ ] **Step 8: Signed-in placeholder home**

`src/app/(app)/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function AppLayout() {
  return <Stack />;
}
```

`src/app/(app)/index.tsx`:

```tsx
import { Button, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function Home() {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>Signed in 🎉 — timeline coming in Plan 3</Text>
      <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  text: { fontSize: 16 },
});
```

Delete the template placeholder if present:

```bash
rm -f src/app/index.tsx
```

- [ ] **Step 9: Full verification**

```bash
npx tsc --noEmit && npm test
```

Expected: typecheck clean; 4 tests pass.

Manual pass (Supabase must be running: `supabase status`):

```bash
npx expo start
```

In the simulator: app opens on **Sign in** → tap through to **Create an account** → sign up `you@test.local` / `password123` → lands on "Signed in 🎉" → Sign out returns to Sign in → sign back in works. Kill and relaunch the app: session persists straight to Home.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: email auth with session-gated routing"
```

---

### Task 8: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  app:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm test

  db:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase db start
      - run: supabase test db
```

- [ ] **Step 2: Verify the same commands locally**

```bash
npx tsc --noEmit && npm test && supabase test db
```

Expected: everything green — this is exactly what CI will run.

- [ ] **Step 3: Commit**

```bash
git add .github
git commit -m "ci: typecheck, jest, and pgTAP database tests"
```

Note: the workflow activates once the repo is pushed to GitHub (no remote exists yet — creating one is a user decision, not part of this plan).

---

## Self-review (done at writing time)

- **Spec coverage (Plan 1 scope):** architecture §2 (Expo + Supabase + no custom server) → Tasks 1, 3; data model §3 incl. XOR constraint and RLS → Tasks 4, 5; RLS-in-CI from §8 → Tasks 5, 8; auth (email tier of §2) → Task 7; family bootstrap → Task 6. Catalogue, corrected age, moments, invites, export, deletion are Plans 2–4 by design.
- **Placeholders:** none — every step has runnable code/commands.
- **Type consistency:** `AuthForm` props match usage in both screens; `useSession` return shape matches `_layout.tsx` usage; SQL helper names (`is_family_member`, `can_access_child`, `can_access_moment`, `create_family`) are consistent between migrations and tests.
