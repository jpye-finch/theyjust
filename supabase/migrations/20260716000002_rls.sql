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
