-- Rollback for 20261023_answer_integrity.sql. APPLY ONLY WITH JOEL'S APPROVAL.
begin;

grant select on public.question_options to anon, authenticated;
grant select on public.questions to anon, authenticated;

drop table if exists public.answer_events;

grant insert, update, delete on public.user_attempts to anon, authenticated;
drop policy if exists "Users can manage own attempts" on public.user_attempts;
create policy "Users can manage own attempts" on public.user_attempts
  for all using ((auth.uid() = user_id));
drop policy if exists "Users can insert their own attempts" on public.user_attempts;
create policy "Users can insert their own attempts" on public.user_attempts
  for insert with check ((user_id = auth.uid()));
drop policy if exists "Users can update their own attempts" on public.user_attempts;
create policy "Users can update their own attempts" on public.user_attempts
  for update using ((user_id = auth.uid()));

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security invoker
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

commit;
