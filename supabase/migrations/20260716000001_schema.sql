create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My family',
  created_by uuid not null references auth.users (id),
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
  created_at timestamptz not null default now()
);

create table public.moments (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  milestone_id text,       -- catalogue id (app-bundled JSON), XOR custom_title
  custom_title text,
  occurred_on date not null,
  note text,
  logged_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint moment_kind check (
    (milestone_id is not null and custom_title is null)
    or (milestone_id is null and custom_title is not null)
  )
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
  created_by uuid not null references auth.users (id),
  expires_at timestamptz not null,
  used_by uuid references auth.users (id)
);

create index moments_child_occurred_idx on public.moments (child_id, occurred_on desc);
create index moment_photos_moment_idx on public.moment_photos (moment_id, position);
create index children_family_idx on public.children (family_id);

-- The Supabase CLI no longer auto-grants privileges on new tables to the API
-- roles (auto_expose_new_tables is unset/deprecated), so without these grants
-- the `authenticated` role gets "permission denied" before RLS is even
-- consulted. RLS (next migration) remains the actual security boundary —
-- these grants are the outer gate, default-deny still applies until policies exist.
grant select, insert, update, delete
  on public.families, public.family_members, public.children,
     public.moments, public.moment_photos, public.invites
  to authenticated;
