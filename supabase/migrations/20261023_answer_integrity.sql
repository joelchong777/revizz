-- APPLY ONLY WITH JOEL'S APPROVAL, after the code deploy.
-- Answer integrity: hide answer columns from the browser, record answer events,
-- stop clients writing attempts, lock XP/streak on profiles.
begin;

-- a. Column privileges (table-level SELECT overrides column revokes, so revoke it first).
revoke select on public.question_options from anon, authenticated;
grant select (id, question_id, label, content_markdown) on public.question_options to anon, authenticated;

revoke select on public.questions from anon, authenticated;
grant select (id, subject_id, topic_id, paper_id, question_number, stem_markdown, image_url,
              cambridge_source_ref, active, created_at, diagram_metadata, status, difficulty)
  on public.questions to anon, authenticated;

-- b. answer_events: server-written log of every answer.
create table if not exists public.answer_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  attempt_no smallint not null,
  option_label text,
  outcome text not null check (outcome in ('first-correct','first-wrong','retry-correct','wrong','timeout')),
  is_final boolean not null,
  xp_awarded int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists answer_events_user_question_created_idx
  on public.answer_events (user_id, question_id, created_at desc);

alter table public.answer_events enable row level security;
drop policy if exists "Users can select own answer events" on public.answer_events;
create policy "Users can select own answer events" on public.answer_events
  for select using (user_id = auth.uid());
drop policy if exists "Staff can select all answer events" on public.answer_events;
create policy "Staff can select all answer events" on public.answer_events
  for select using (public.get_user_role(auth.uid()) in ('teacher','admin'));
revoke insert, update, delete on public.answer_events from anon, authenticated;

-- c. user_attempts: server inserts only.
drop policy if exists "Users can manage own attempts" on public.user_attempts;
drop policy if exists "Users can insert their own attempts" on public.user_attempts;
drop policy if exists "Users can update their own attempts" on public.user_attempts;
revoke insert, update, delete on public.user_attempts from anon, authenticated;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_attempts'
      and policyname = 'Users can select their own attempts'
  ) then
    create policy "Users can select their own attempts" on public.user_attempts
      for select using (user_id = auth.uid());
  end if;
end $$;

-- d. profiles guard also freezes total_xp and current_streak on UPDATE.
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
      new.total_xp := old.total_xp;
      new.current_streak := old.current_streak;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.protect_profile_privileged_columns() from public, anon, authenticated;

commit;
