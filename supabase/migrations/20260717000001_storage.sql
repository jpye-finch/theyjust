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
