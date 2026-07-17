begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select has_table('storage', 'objects', 'storage.objects exists');
select has_function(
  'public', 'can_access_moment', array['uuid'],
  'can_access_moment helper is present (from Plan 1)');

-- Seed: two families, a child + moment in Alice's family, and a storage object
-- for that moment. (superuser bypasses RLS for seeding.)
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
  ('00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-0000000000fa', 'Alice Jr', '2026-01-01');
insert into public.moments (id, child_id, milestone_id, occurred_on, logged_by) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000ca',
   'first_smile', '2026-03-01', '00000000-0000-0000-0000-0000000000a1');
insert into storage.buckets (id, name, public) values ('moment-photos', 'moment-photos', false)
  on conflict (id) do nothing;
insert into storage.objects (bucket_id, name, owner)
  values ('moment-photos', '00000000-0000-0000-0000-0000000000d1/p1.jpg',
          '00000000-0000-0000-0000-0000000000a1');

-- As Bob (not in Alice's family): the object must be invisible.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}', true);
select is(
  (select count(*) from storage.objects where bucket_id = 'moment-photos'),
  0::bigint,
  'Bob cannot see a photo object belonging to Alice''s moment');

-- As Alice: the object is visible.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select is(
  (select count(*) from storage.objects where bucket_id = 'moment-photos'),
  1::bigint,
  'Alice can see her own moment''s photo object');

select * from finish();
rollback;
