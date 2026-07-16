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
