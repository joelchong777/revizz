-- Test fixture: stub Supabase roles/auth schema + the LIVE (pre-lockdown) functions and policies, 2026-10-22.
-- Used only by scripts/verify-rls-lockdown.ts against PGlite. Never apply to a real project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}'::jsonb);
create table auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid, provider text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
grant usage on schema auth to anon, authenticated, service_role;

-- storage stub
create schema if not exists storage;
create table storage.buckets (id text primary key, name text);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to anon, authenticated, service_role;
create policy "Public read question-diagrams" on storage.objects for select using (bucket_id='question-diagrams');
create policy "anon write question-diagrams" on storage.objects for insert to anon with check (bucket_id='question-diagrams');
create policy "public update question-diagrams" on storage.objects for update using (bucket_id='question-diagrams');
create policy "public delete question-diagrams" on storage.objects for delete using (bucket_id='question-diagrams');

create table public.subjects (id uuid primary key default gen_random_uuid(), name text);
create table public.topics (id uuid primary key default gen_random_uuid(), subject_id uuid, name text);
create table public.papers (id uuid primary key default gen_random_uuid(), title text, active boolean default true);
create table public.questions (id uuid primary key default gen_random_uuid(), paper_id uuid, topic_id uuid, stem text, active boolean default true, explanation_markdown text);
create table public.question_options (id uuid primary key default gen_random_uuid(), question_id uuid references public.questions(id) on delete cascade, label text, text text, is_correct boolean default false);
create table public.profiles (
  id uuid primary key, display_name text, email text, role text default 'student', is_school_account boolean default false,
  total_xp int default 0, current_streak int default 0, opt_in_leaderboard boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now());
create table public.user_attempts (id uuid primary key default gen_random_uuid(), user_id uuid, question_id uuid);
create table public.review_pile (id uuid primary key default gen_random_uuid(), user_id uuid, question_id uuid);
create table public.roster_invites (id uuid primary key default gen_random_uuid(), email text, display_name text, role text default 'student', cohort text, invited_by uuid, status text default 'pending', created_at timestamptz default now());

-- LIVE functions
create function public.get_user_role(user_id uuid) returns text language sql security definer as $$ SELECT role FROM public.profiles WHERE id = user_id; $$;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text := 'student'; v_school boolean := false; v_name text;
begin
  select ri.role, true into v_role, v_school from public.roster_invites ri where lower(ri.email)=lower(new.email) order by ri.created_at desc limit 1;
  if not found then v_role := 'student'; v_school := false; end if;
  if new.email ilike '%frontier%' then v_school := true; end if;
  v_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
  insert into public.profiles (id, display_name, email, role, is_school_account, total_xp, current_streak, opt_in_leaderboard)
  values (new.id, v_name, new.email, v_role, v_school, 0, 0, false)
  on conflict (id) do update set email = excluded.email,
    role = case when profiles.role='admin' then 'admin' else excluded.role end,
    is_school_account = excluded.is_school_account or profiles.is_school_account;
  update public.roster_invites set status='claimed' where lower(email)=lower(new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.admin_create_user(new_email text, new_password text, new_role text default 'student', new_name text default null, new_cohort text default 'General', new_is_school boolean default false)
returns uuid language plpgsql security definer as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, email_confirmed_at) values (uid, new_email, now());
  return uid;
end $$;

-- grants matching Supabase defaults (functions executable by PUBLIC by default)
grant all on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.papers enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.profiles enable row level security;
alter table public.user_attempts enable row level security;
alter table public.review_pile enable row level security;
alter table public.roster_invites enable row level security;

-- papers
create policy "Allow anon delete papers" on public.papers for delete to anon using (true);
create policy "Allow anon insert papers" on public.papers for insert to anon with check (true);
create policy "Allow anon update papers" on public.papers for update to anon using (true);
create policy "Admins can delete papers" on public.papers for delete using (public.get_user_role(auth.uid())='admin');
create policy "Admins can update papers" on public.papers for update using (public.get_user_role(auth.uid())='admin');
create policy "Admins can insert papers" on public.papers for insert with check (public.get_user_role(auth.uid())='admin');
create policy "Allow public SELECT on active papers" on public.papers for select using (true);
create policy "Public read papers" on public.papers for select using (true);
-- profiles
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid()=id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid()=id);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid()=id);
create policy "Teachers and admins can view all profiles" on public.profiles for select using (public.get_user_role(auth.uid()) in ('teacher','admin'));
create policy "Users can select all opt_in profiles" on public.profiles for select using (opt_in_leaderboard or id=auth.uid());
create policy "Profiles selectable if opt_in_leaderboard" on public.profiles for select using (opt_in_leaderboard or id=auth.uid());
create policy "Admins can update user roles" on public.profiles for update using (public.get_user_role(auth.uid())='admin');
-- question_options
create policy "Admins can insert question_options" on public.question_options for insert with check (public.get_user_role(auth.uid())='admin');
create policy "Admins can delete question_options" on public.question_options for delete using (public.get_user_role(auth.uid())='admin');
create policy "Admins can update question_options" on public.question_options for update using (public.get_user_role(auth.uid())='admin');
create policy "Public read question options" on public.question_options for select using (true);
create policy "Allow public SELECT on active question_options" on public.question_options for select using (exists (select 1 from public.questions q where q.id=question_id and q.active));
create policy "Allow anon delete question_options" on public.question_options for delete to anon using (true);
create policy "Allow anon update question_options" on public.question_options for update to anon using (true);
create policy "Allow anon insert question_options" on public.question_options for insert to anon with check (true);
-- questions
create policy "Admins can delete questions" on public.questions for delete using (public.get_user_role(auth.uid())='admin');
create policy "Admins can insert questions" on public.questions for insert with check (public.get_user_role(auth.uid())='admin');
create policy "Admins can update questions" on public.questions for update using (public.get_user_role(auth.uid())='admin');
create policy "Allow public SELECT on active questions" on public.questions for select using (active = true);
create policy "Public read active questions" on public.questions for select using (active = true);
create policy "Allow anon delete questions" on public.questions for delete to anon using (true);
create policy "Allow anon insert questions" on public.questions for insert to anon with check (true);
create policy "Allow anon update questions" on public.questions for update to anon using (true);
create policy "Allow anon select all questions" on public.questions for select to anon using (true);
-- own-row
create policy "own attempts" on public.user_attempts for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "staff select attempts" on public.user_attempts for select using (public.get_user_role(auth.uid()) in ('teacher','admin'));
create policy "own review" on public.review_pile for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "staff select review" on public.review_pile for select using (public.get_user_role(auth.uid()) in ('teacher','admin'));
-- roster_invites
create policy "Allow public read and insert on roster_invites" on public.roster_invites for all using (true) with check (true);
-- subjects
create policy "Public read subjects" on public.subjects for select using (true);
create policy "Allow public SELECT on subjects" on public.subjects for select using (true);
create policy "Allow anon update subjects" on public.subjects for update to anon using (true);
create policy "Allow anon insert subjects" on public.subjects for insert to anon with check (true);
create policy "Admins can insert subjects" on public.subjects for insert with check (public.get_user_role(auth.uid())='admin');
create policy "Admins can update subjects" on public.subjects for update using (public.get_user_role(auth.uid())='admin');
create policy "Admins can delete subjects" on public.subjects for delete using (public.get_user_role(auth.uid())='admin');
-- topics
create policy "Public read topics" on public.topics for select using (true);
create policy "Allow public SELECT on topics" on public.topics for select using (true);
create policy "Admins can insert topics" on public.topics for insert with check (public.get_user_role(auth.uid())='admin');
create policy "Admins can update topics" on public.topics for update using (public.get_user_role(auth.uid())='admin');
create policy "Admins can delete topics" on public.topics for delete using (public.get_user_role(auth.uid())='admin');
create policy "Allow anon insert topics" on public.topics for insert to anon with check (true);
create policy "Allow anon update topics" on public.topics for update to anon using (true);
