begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

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

insert into public.invites (family_id, code, created_by, expires_at) values
  ('00000000-0000-0000-0000-0000000000fa', 'ALICE-INVITE',
   '00000000-0000-0000-0000-0000000000a1', now() + interval '7 days');

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

-- Bob cannot MUTATE Alice's rows (RLS filters silently: 0 rows affected).
with u as (update public.moments set note = 'hacked'
           where id = '00000000-0000-0000-0000-0000000000d1' returning 1)
select is((select count(*) from u), 0::bigint,
  'Bob cannot update Alice''s moment');

with d as (delete from public.moments
           where id = '00000000-0000-0000-0000-0000000000d1' returning 1)
select is((select count(*) from d), 0::bigint,
  'Bob cannot delete Alice''s moment');

with u as (update public.children set name = 'hacked'
           where id = '00000000-0000-0000-0000-0000000000ca' returning 1)
select is((select count(*) from u), 0::bigint,
  'Bob cannot update Alice''s child');

with d as (delete from public.children
           where id = '00000000-0000-0000-0000-0000000000ca' returning 1)
select is((select count(*) from d), 0::bigint,
  'Bob cannot delete Alice''s child');

with u as (update public.families set name = 'hacked'
           where id = '00000000-0000-0000-0000-0000000000fa' returning 1)
select is((select count(*) from u), 0::bigint,
  'Bob cannot rename Alice''s family');

select throws_ok(
  $$insert into public.moment_photos (moment_id, storage_path)
    values ('00000000-0000-0000-0000-0000000000d1', 'intruder.jpg')$$,
  '42501', null,
  'Bob cannot attach a photo to Alice''s moment');

with d as (delete from public.moment_photos
           where id = '00000000-0000-0000-0000-0000000000e1' returning 1)
select is((select count(*) from d), 0::bigint,
  'Bob cannot delete Alice''s photo');

select is((select count(*) from public.invites), 0::bigint,
  'Bob sees none of Alice''s invites');

-- Back to Alice: positive controls prove the write paths actually work.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);

with u as (update public.moments set note = 'Her first smile!'
           where id = '00000000-0000-0000-0000-0000000000d1' returning 1)
select is((select count(*) from u), 1::bigint,
  'Alice can update her own moment');

with u as (update public.families set name = 'The Alices'
           where id = '00000000-0000-0000-0000-0000000000fa' returning 1)
select is((select count(*) from u), 1::bigint,
  'Alice can rename her own family');

select throws_ok(
  $$update public.families set created_by = '00000000-0000-0000-0000-0000000000b1'
    where id = '00000000-0000-0000-0000-0000000000fa'$$,
  '42501', null,
  'created_by is not writable even by a family member (column-scoped grant)');

select * from finish();
rollback;
