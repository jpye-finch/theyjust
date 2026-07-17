begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

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
-- A malformed-path object (first segment is not a uuid): the policy must DENY
-- it without erroring, so it can never break RLS for the whole bucket. Because
-- the assertions below query storage.objects, an unguarded ::uuid cast would
-- make them ERROR rather than return a count — this row is the guard.
insert into storage.objects (bucket_id, name, owner)
  values ('moment-photos', 'not-a-uuid/junk.jpg', '00000000-0000-0000-0000-0000000000a1');

-- As Bob (not in Alice's family): neither object is visible.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}', true);
select is(
  (select count(*) from storage.objects where bucket_id = 'moment-photos'),
  0::bigint,
  'Bob cannot see a photo object belonging to Alice''s moment');

-- As Alice: exactly her one valid object (the malformed one is denied, not errored).
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select is(
  (select count(*) from storage.objects where bucket_id = 'moment-photos'),
  1::bigint,
  'Alice sees her valid object; the malformed-path object neither errors nor shows');

-- Write gate: Alice may upload under her own moment; Bob may not.
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('moment-photos', '00000000-0000-0000-0000-0000000000d1/p2.jpg',
            '00000000-0000-0000-0000-0000000000a1')$$,
  'Alice can upload under her own moment');

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('moment-photos', '00000000-0000-0000-0000-0000000000d1/evil.jpg',
            '00000000-0000-0000-0000-0000000000b1')$$,
  '42501', null,
  'Bob cannot upload under Alice''s moment');

select * from finish();
rollback;
