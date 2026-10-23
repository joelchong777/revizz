-- APPLY ONLY WITH JOEL'S APPROVAL, after the code deploy.
-- Server-backed page visibility: admins choose which student and teacher pages are shown.
-- Rows exist only for pages an admin has changed; a missing row means the page is enabled.
begin;

create table if not exists public.page_visibility (
  page_id text primary key,
  enabled boolean not null default true,
  updated_at timestamptz default now(),
  updated_by uuid
);

alter table public.page_visibility enable row level security;

drop policy if exists "Anyone can read page_visibility" on public.page_visibility;
create policy "Anyone can read page_visibility" on public.page_visibility
  for select to anon, authenticated
  using (true);

drop policy if exists "Admins insert page_visibility" on public.page_visibility;
create policy "Admins insert page_visibility" on public.page_visibility
  for insert
  with check (public.get_user_role(auth.uid()) = 'admin');

drop policy if exists "Admins update page_visibility" on public.page_visibility;
create policy "Admins update page_visibility" on public.page_visibility
  for update
  using (public.get_user_role(auth.uid()) = 'admin')
  with check (public.get_user_role(auth.uid()) = 'admin');

drop policy if exists "Admins delete page_visibility" on public.page_visibility;
create policy "Admins delete page_visibility" on public.page_visibility
  for delete
  using (public.get_user_role(auth.uid()) = 'admin');

commit;
