begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000e1', 'newparent@test.local');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated"}', true);

select lives_ok(
  $$select public.create_family('Pye-Finch family')$$,
  'a fresh user can create a family');

select is((select count(*) from public.families), 1::bigint,
  'the new family is visible to its creator');
select is((select name from public.families), 'Pye-Finch family',
  'with the requested name');
select is(
  (select role from public.family_members
   where user_id = '00000000-0000-0000-0000-0000000000e1'),
  'owner',
  'creator is enrolled as owner');

-- Anonymous callers are rejected at the grant layer (fail closed): the
-- migration revokes EXECUTE from anon, so the call never reaches the body.
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select throws_ok(
  $$select public.create_family('Sneaky family')$$,
  '42501', null,
  'anonymous caller is rejected by the EXECUTE grant');

-- Defense in depth: an authenticated role with no user id (no sub claim)
-- passes the grant layer but is rejected by the body's auth.uid() check.
set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$select public.create_family('Sneaky family')$$,
  'P0001', 'not authenticated',
  'caller without a user id is rejected by the body check');

select * from finish();
rollback;
