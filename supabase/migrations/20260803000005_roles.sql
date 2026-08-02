-- Product model: content (folders, sets, questions) is curated by admins and
-- readable by every signed-in user; activity (sessions, attempts) stays
-- strictly per-user. The first account ever created becomes the admin.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column role text not null default 'user' check (role in ('user', 'admin'));

-- Definer so table policies can check the caller's role without being blocked
-- by the profiles select-own policy.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- Bootstrap: the very first user becomes admin; everyone after is a user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    case
      when exists (select 1 from public.profiles where role = 'admin') then 'user'
      else 'admin'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Content: shared read, admin-only write
-- ---------------------------------------------------------------------------

-- folders
drop policy "folders_select_own" on public.folders;
drop policy "folders_insert_own" on public.folders;
drop policy "folders_update_own" on public.folders;
drop policy "folders_delete_own" on public.folders;

create policy "folders_select_all" on public.folders
  for select to authenticated using (true);
create policy "folders_admin_insert" on public.folders
  for insert to authenticated with check (owner_id = (select auth.uid()) and public.is_admin());
create policy "folders_admin_update" on public.folders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "folders_admin_delete" on public.folders
  for delete to authenticated using (public.is_admin());

-- question_sets
drop policy "question_sets_select_own" on public.question_sets;
drop policy "question_sets_insert_own" on public.question_sets;
drop policy "question_sets_update_own" on public.question_sets;
drop policy "question_sets_delete_own" on public.question_sets;

create policy "question_sets_select_all" on public.question_sets
  for select to authenticated using (true);
create policy "question_sets_admin_insert" on public.question_sets
  for insert to authenticated with check (owner_id = (select auth.uid()) and public.is_admin());
create policy "question_sets_admin_update" on public.question_sets
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "question_sets_admin_delete" on public.question_sets
  for delete to authenticated using (public.is_admin());

-- questions
drop policy "questions_select_own" on public.questions;
drop policy "questions_insert_own" on public.questions;
drop policy "questions_update_own" on public.questions;
drop policy "questions_delete_own" on public.questions;

create policy "questions_select_all" on public.questions
  for select to authenticated using (true);
create policy "questions_admin_insert" on public.questions
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and public.is_admin()
    and exists (select 1 from public.question_sets s where s.id = set_id)
  );
create policy "questions_admin_update" on public.questions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "questions_admin_delete" on public.questions
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Activity: unchanged ownership, but attempts/session membership may now
-- reference any (shared) question, not just ones the user owns.
-- ---------------------------------------------------------------------------

drop policy "attempts_insert_own" on public.attempts;
create policy "attempts_insert_own" on public.attempts
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.questions q where q.id = question_id)
  );

drop policy "session_questions_insert_own" on public.session_questions;
create policy "session_questions_insert_own" on public.session_questions
  for insert to authenticated with check (
    exists (
      select 1 from public.test_sessions ts
      where ts.id = session_id and ts.owner_id = (select auth.uid())
    )
    and exists (select 1 from public.questions q where q.id = question_id)
  );
