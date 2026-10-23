-- Rollback for 20261027_invite_role_on_confirm.sql: restores the handle_new_user()
-- body that was live on 2026-10-24 (applies the invite role at sign-up).
-- APPLY ONLY WITH JOEL'S APPROVAL.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := 'student';
  v_is_school boolean := false;
  v_name text;
begin
  select role into v_role from public.roster_invites where lower(email) = lower(new.email) limit 1;

  if v_role is not null then
    v_is_school := true;
  else
    v_role := 'student';
  end if;

  if new.email ilike '%frontier%' then
    v_is_school := true;
  end if;

  v_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  insert into public.profiles (id, display_name, email, is_school_account, total_xp, current_streak, opt_in_leaderboard, role)
  values (new.id, v_name, new.email, v_is_school, 0, 0, false, v_role)
  on conflict (id) do update set
    email = excluded.email,
    role = case when public.profiles.role = 'admin' then 'admin' else excluded.role end,
    is_school_account = excluded.is_school_account or public.profiles.is_school_account;

  update public.roster_invites set status = 'claimed' where lower(email) = lower(new.email);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;

commit;
