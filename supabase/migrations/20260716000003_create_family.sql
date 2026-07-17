-- The only function end users call directly: bootstraps a brand-new account
-- past RLS (there is deliberately no insert policy on families/family_members).
-- Idempotent for ANY existing membership, not just owners: a retried or
-- double-tapped call — or an invited co-parent (role 'parent', Plan 4) calling
-- it during onboarding — returns the family the user already belongs to
-- instead of forking them into a phantom family of their own.
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
  -- already-a-member check below and each create a family.
  perform pg_advisory_xact_lock(hashtext('create_family:' || auth.uid()::text));

  select family_id into fam_id
    from public.family_members
   where user_id = auth.uid()
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
