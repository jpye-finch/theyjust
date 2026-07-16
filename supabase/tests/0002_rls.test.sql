begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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

select * from finish();
rollback;
