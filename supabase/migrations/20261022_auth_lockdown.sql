-- Auth lockdown, Phase 0.
-- Closes anon write access to content tables, locks down roster_invites and
-- profiles privileged columns, revokes anon execute on SECURITY DEFINER admin
-- functions, adds a server-side claim_roster_invite(), and restricts storage
-- writes on bucket 'question-diagrams' to admins.
-- APPLY ONLY WITH JOEL'S APPROVAL. Review storage.objects policies first
-- (section 9 drops anon/public write policies there; record them before applying).
-- Idempotent: safe to re-run.

begin;

-- 1. admin_create_user: service role only.
revoke execute on function public.admin_create_user(text,text,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.admin_create_user(text,text,text,text,text,boolean) to service_role;

-- 2. handle_new_user: trigger still fires; nobody can call it directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 3. get_user_role: only answers for the caller's own id.
create or replace function public.get_user_role(user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$ select role from public.profiles where id = user_id and user_id = auth.uid() $$;
grant execute on function public.get_user_role(uuid) to anon, authenticated;

-- 4. Drop anon write policies on content tables.
drop policy if exists "Allow anon delete papers" on public.papers;
drop policy if exists "Allow anon insert papers" on public.papers;
drop policy if exists "Allow anon update papers" on public.papers;
drop policy if exists "Allow anon delete question_options" on public.question_options;
drop policy if exists "Allow anon update question_options" on public.question_options;
drop policy if exists "Allow anon insert question_options" on public.question_options;
drop policy if exists "Allow anon delete questions" on public.questions;
drop policy if exists "Allow anon insert questions" on public.questions;
drop policy if exists "Allow anon select all questions" on public.questions;
drop policy if exists "Allow anon update questions" on public.questions;
drop policy if exists "Allow anon update subjects" on public.subjects;
drop policy if exists "Allow anon insert subjects" on public.subjects;
drop policy if exists "Allow anon insert topics" on public.topics;
drop policy if exists "Allow anon update topics" on public.topics;

-- 5. Admins can still see every question (including non-active ones).
drop policy if exists "Admins can select all questions" on public.questions;
create policy "Admins can select all questions" on public.questions
  for select using (public.get_user_role(auth.uid()) = 'admin');

-- 6. roster_invites.
drop policy if exists "Allow public read and insert on roster_invites" on public.roster_invites;

drop policy if exists "Admins manage roster_invites" on public.roster_invites;
create policy "Admins manage roster_invites" on public.roster_invites
  for all
  using (public.get_user_role(auth.uid()) = 'admin')
  with check (public.get_user_role(auth.uid()) = 'admin');

drop policy if exists "Teachers read roster_invites" on public.roster_invites;
create policy "Teachers read roster_invites" on public.roster_invites
  for select
  using (public.get_user_role(auth.uid()) in ('teacher','admin'));

drop policy if exists "Teachers invite students" on public.roster_invites;
create policy "Teachers invite students" on public.roster_invites
  for insert
  with check (public.get_user_role(auth.uid()) = 'teacher' and role = 'student');

drop policy if exists "Teachers update student invites" on public.roster_invites;
create policy "Teachers update student invites" on public.roster_invites
  for update
  using (public.get_user_role(auth.uid()) = 'teacher' and role = 'student')
  with check (public.get_user_role(auth.uid()) = 'teacher' and role = 'student');

drop policy if exists "Teachers delete student invites" on public.roster_invites;
create policy "Teachers delete student invites" on public.roster_invites
  for delete
  using (public.get_user_role(auth.uid()) = 'teacher' and role = 'student');

-- 7. Protect privileged profile columns from browser clients.
-- NOTE: XP and streak updates stay allowed for now because the quiz writes them
-- from the browser; Phase 3 moves that server-side.
-- SECURITY DEFINER functions (handle_new_user, admin_create_user) run as the
-- owner, so current_user is not anon/authenticated and they are unaffected.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security invoker -- must be invoker: under definer, current_user is the owner and the guard never fires
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated')
     and coalesce(public.get_user_role(auth.uid()), '') <> 'admin' then
    if tg_op = 'INSERT' then
      new.role := 'student';
      new.is_school_account := false;
      new.total_xp := 0;
      new.current_streak := 0;
    else
      new.id := old.id;
      new.role := old.role;
      new.is_school_account := old.is_school_account;
      new.email := old.email;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.protect_profile_privileged_columns() from public, anon, authenticated;

drop trigger if exists protect_profile_privileged_columns on public.profiles;
create trigger protect_profile_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- 8. Server-side invite claim (verified email only).
create or replace function public.claim_roster_invite()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  inv record;
  resulting_role text;
begin
  if uid is null then
    return null;
  end if;

  select u.email into user_email
  from auth.users u
  where u.id = uid and u.email_confirmed_at is not null;
  if user_email is null then
    return null;
  end if;

  select * into inv
  from public.roster_invites ri
  where lower(ri.email) = lower(user_email) and ri.status = 'pending'
  order by ri.created_at desc
  limit 1;
  if not found then
    return null;
  end if;

  update public.profiles p
  set role = case when p.role = 'admin' then 'admin' else inv.role end,
      is_school_account = true
  where p.id = uid
  returning p.role into resulting_role;

  update public.roster_invites set status = 'claimed' where id = inv.id;

  return jsonb_build_object('role', resulting_role, 'cohort', inv.cohort);
end;
$$;
revoke execute on function public.claim_roster_invite() from public, anon;
grant execute on function public.claim_roster_invite() to authenticated;

-- 9. Storage: bucket 'question-diagrams' writes are admin-only.
do $$
declare
  pol record;
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'objects') then
    for pol in
      select policyname
      from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and cmd <> 'SELECT'
        and (roles @> '{anon}' or roles @> '{public}')
        and coalesce(qual, '') || coalesce(with_check, '') not ilike '%get_user_role%'
    loop
      raise notice 'Dropping storage.objects policy: %', pol.policyname;
      execute format('drop policy %I on storage.objects', pol.policyname);
    end loop;

    drop policy if exists "Admins write question-diagrams insert" on storage.objects;
    create policy "Admins write question-diagrams insert" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'question-diagrams' and public.get_user_role(auth.uid()) = 'admin');

    drop policy if exists "Admins write question-diagrams update" on storage.objects;
    create policy "Admins write question-diagrams update" on storage.objects
      for update to authenticated
      using (bucket_id = 'question-diagrams' and public.get_user_role(auth.uid()) = 'admin')
      with check (bucket_id = 'question-diagrams' and public.get_user_role(auth.uid()) = 'admin');

    drop policy if exists "Admins write question-diagrams delete" on storage.objects;
    create policy "Admins write question-diagrams delete" on storage.objects
      for delete to authenticated
      using (bucket_id = 'question-diagrams' and public.get_user_role(auth.uid()) = 'admin');
  end if;
end
$$;

commit;
