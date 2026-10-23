-- Invite role is applied only after the email is confirmed.
-- handle_new_user() used to read roster_invites and give the new profile the
-- invited role at sign-up, before the email was confirmed. Anyone who knew an
-- invited address could sign up with it and get a teacher or admin-ish role.
-- Now the trigger always creates a 'student' profile and never touches invites.
-- The role is applied by claim_roster_invite() (20261022_auth_lockdown.sql),
-- which requires auth.users.email_confirmed_at and runs at every session load.
-- APPLY ONLY WITH JOEL'S APPROVAL.
-- Idempotent: safe to re-run. Rollback: supabase/rollback/20261027_invite_role_on_confirm_down.sql

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_school boolean := false;
  v_name text;
begin
  if new.email ilike '%frontier%' then
    v_is_school := true;
  end if;

  v_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  insert into public.profiles (id, display_name, email, is_school_account, total_xp, current_streak, opt_in_leaderboard, role)
  values (new.id, v_name, new.email, v_is_school, 0, 0, false, 'student')
  on conflict (id) do update set
    email = excluded.email,
    -- keep the existing role; never take one from an invite here
    role = public.profiles.role,
    is_school_account = excluded.is_school_account or public.profiles.is_school_account;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;

commit;
