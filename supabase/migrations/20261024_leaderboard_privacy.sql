-- APPLY ONLY WITH JOEL'S APPROVAL, after the code deploy.
-- Leaderboard privacy (audit B5): stop exposing full profile rows (email included)
-- of opted-in users; serve the leaderboard through a narrow SECURITY DEFINER function.
begin;

drop policy if exists "Users can select all opt_in profiles" on public.profiles;
drop policy if exists "Profiles selectable if opt_in_leaderboard" on public.profiles;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can select own profile'
  ) then
    create policy "Users can select own profile" on public.profiles
      for select using (id = auth.uid());
  end if;
end $$;

create or replace function public.get_leaderboard(p_limit int default 10)
returns table (
  display_name text,
  total_xp int,
  current_streak int,
  is_school_account boolean,
  rank int,
  is_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.display_name::text,
    p.total_xp::int,
    p.current_streak::int,
    p.is_school_account::boolean,
    (row_number() over (order by p.total_xp desc, p.id))::int as rank,
    (p.id = auth.uid()) as is_me
  from public.profiles p
  where p.opt_in_leaderboard = true
  order by p.total_xp desc, p.id
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.get_leaderboard(int) from public;
grant execute on function public.get_leaderboard(int) to anon, authenticated;

commit;
