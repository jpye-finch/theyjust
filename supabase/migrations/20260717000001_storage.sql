-- Private bucket for moment photos. Access is decided per object by the moment
-- the object's first path segment names, reusing the Plan 1 membership helper.
insert into storage.buckets (id, name, public)
values ('moment-photos', 'moment-photos', false)
on conflict (id) do nothing;

-- The first path segment is the moment id: "{moment_id}/{filename}".
-- (storage.foldername(name))[1] is that segment.
create policy moment_photos_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'moment-photos'
    and public.can_access_moment(((storage.foldername(name))[1])::uuid)
  );

create policy moment_photos_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'moment-photos'
    and public.can_access_moment(((storage.foldername(name))[1])::uuid)
  );

create policy moment_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'moment-photos'
    and public.can_access_moment(((storage.foldername(name))[1])::uuid)
  );
