-- Rollback for 20261024_leaderboard_privacy.sql. LOCAL ONLY; apply only with Joel's approval.
begin;

drop function if exists public.get_leaderboard(int);
drop policy if exists "Users can select own profile" on public.profiles;

drop policy if exists "Users can select all opt_in profiles" on public.profiles;
create policy "Users can select all opt_in profiles" on public.profiles
  for select using ((opt_in_leaderboard = true) or (auth.uid() = id));

drop policy if exists "Profiles selectable if opt_in_leaderboard" on public.profiles;
create policy "Profiles selectable if opt_in_leaderboard" on public.profiles
  for select using ((opt_in_leaderboard = true) or (auth.uid() = id));

commit;
