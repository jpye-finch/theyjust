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
