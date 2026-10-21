-- Rollback for 20261022_auth_lockdown.sql. Restores the OPEN (insecure) state.
-- Apply only with Joel's approval.
-- Storage: policies dropped in section 9 of the migration cannot be restored
-- blindly. The lead must record them (select * from pg_policies where
-- schemaname='storage') BEFORE applying the migration and re-create them by hand.

begin;

-- Restore grants.
grant execute on function public.admin_create_user(text,text,text,text,text,boolean) to anon, authenticated;
grant execute on function public.handle_new_user() to anon, authenticated;

-- Restore old get_user_role body.
create or replace function public.get_user_role(user_id uuid)
returns text
language sql
stable
security definer
as $$ select role from public.profiles where id = user_id $$;

-- Drop new objects.
drop policy if exists "Admins can select all questions" on public.questions;
drop policy if exists "Admins manage roster_invites" on public.roster_invites;
drop policy if exists "Teachers read roster_invites" on public.roster_invites;
drop policy if exists "Teachers invite students" on public.roster_invites;
drop policy if exists "Teachers update student invites" on public.roster_invites;
drop policy if exists "Teachers delete student invites" on public.roster_invites;
drop trigger if exists protect_profile_privileged_columns on public.profiles;
drop function if exists public.protect_profile_privileged_columns();
drop function if exists public.claim_roster_invite();

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'objects') then
    drop policy if exists "Admins write question-diagrams insert" on storage.objects;
    drop policy if exists "Admins write question-diagrams update" on storage.objects;
    drop policy if exists "Admins write question-diagrams delete" on storage.objects;
  end if;
end
$$;

-- Restore dropped public-schema policies exactly (anon, true).
drop policy if exists "Allow anon delete papers" on public.papers;
create policy "Allow anon delete papers" on public.papers for delete to anon using (true);
drop policy if exists "Allow anon insert papers" on public.papers;
create policy "Allow anon insert papers" on public.papers for insert to anon with check (true);
drop policy if exists "Allow anon update papers" on public.papers;
create policy "Allow anon update papers" on public.papers for update to anon using (true) with check (true);

drop policy if exists "Allow anon delete question_options" on public.question_options;
create policy "Allow anon delete question_options" on public.question_options for delete to anon using (true);
drop policy if exists "Allow anon update question_options" on public.question_options;
create policy "Allow anon update question_options" on public.question_options for update to anon using (true) with check (true);
drop policy if exists "Allow anon insert question_options" on public.question_options;
create policy "Allow anon insert question_options" on public.question_options for insert to anon with check (true);

drop policy if exists "Allow anon delete questions" on public.questions;
create policy "Allow anon delete questions" on public.questions for delete to anon using (true);
drop policy if exists "Allow anon insert questions" on public.questions;
create policy "Allow anon insert questions" on public.questions for insert to anon with check (true);
drop policy if exists "Allow anon select all questions" on public.questions;
create policy "Allow anon select all questions" on public.questions for select to anon using (true);
drop policy if exists "Allow anon update questions" on public.questions;
create policy "Allow anon update questions" on public.questions for update to anon using (true) with check (true);

drop policy if exists "Allow anon update subjects" on public.subjects;
create policy "Allow anon update subjects" on public.subjects for update to anon using (true) with check (true);
drop policy if exists "Allow anon insert subjects" on public.subjects;
create policy "Allow anon insert subjects" on public.subjects for insert to anon with check (true);

drop policy if exists "Allow anon insert topics" on public.topics;
create policy "Allow anon insert topics" on public.topics for insert to anon with check (true);
drop policy if exists "Allow anon update topics" on public.topics;
create policy "Allow anon update topics" on public.topics for update to anon using (true) with check (true);

drop policy if exists "Allow public read and insert on roster_invites" on public.roster_invites;
create policy "Allow public read and insert on roster_invites" on public.roster_invites
  for all to public using (true) with check (true);

commit;
