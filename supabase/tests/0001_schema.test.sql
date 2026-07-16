begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select has_table('public', 'families', 'families table exists');
select has_table('public', 'family_members', 'family_members table exists');
select has_table('public', 'children', 'children table exists');
select has_table('public', 'moments', 'moments table exists');
select has_table('public', 'moment_photos', 'moment_photos table exists');
select has_table('public', 'invites', 'invites table exists');

select has_column('public', 'moment_photos', 'storage_path', 'moment_photos.storage_path exists');
select has_column('public', 'moment_photos', 'position', 'moment_photos.position exists');
select has_column('public', 'invites', 'code', 'invites.code exists');
select has_column('public', 'invites', 'expires_at', 'invites.expires_at exists');

-- Seed enough rows to exercise the moments XOR constraint (superuser bypasses RLS).
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000000a', 'seed@test.local');
insert into public.families (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000f1', 'Testers', '00000000-0000-0000-0000-00000000000a');
insert into public.children (id, family_id, name, date_of_birth)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'Test Baby', '2026-01-01');

select lives_ok(
  $$insert into public.moments (child_id, milestone_id, occurred_on, logged_by)
    values ('00000000-0000-0000-0000-0000000000c1', 'rolled_over', '2026-05-01',
            '00000000-0000-0000-0000-00000000000a')$$,
  'catalogue moment (milestone_id only) is valid');

select lives_ok(
  $$insert into public.moments (child_id, custom_title, occurred_on, logged_by)
    values ('00000000-0000-0000-0000-0000000000c1', 'First haircut', '2026-06-01',
            '00000000-0000-0000-0000-00000000000a')$$,
  'custom moment (custom_title only) is valid');

select throws_ok(
  $$insert into public.moments (child_id, milestone_id, custom_title, occurred_on, logged_by)
    values ('00000000-0000-0000-0000-0000000000c1', 'rolled_over', 'Also custom', '2026-06-01',
            '00000000-0000-0000-0000-00000000000a')$$,
  '23514',
  null,
  'moment with BOTH milestone_id and custom_title violates XOR constraint');

select throws_ok(
  $$insert into public.moments (child_id, occurred_on, logged_by)
    values ('00000000-0000-0000-0000-0000000000c1', '2026-06-01',
            '00000000-0000-0000-0000-00000000000a')$$,
  '23514',
  null,
  'moment with NEITHER milestone_id nor custom_title violates XOR constraint');

select * from finish();
rollback;
