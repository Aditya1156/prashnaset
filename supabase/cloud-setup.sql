-- PrashnaSet initial schema.
-- Every table is RLS'd to its owner: owner_id = auth.uid() for select/insert/update/delete.
-- Tables are NOT auto-exposed to API roles anymore, so grants are explicit per table.

-- ---------------------------------------------------------------------------
-- profiles: mirrors auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using (id = (select auth.uid()));

-- Auto-create a profile row on signup. Runs as definer so it can insert
-- before the user has a session.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- question_sets: one row per imported JSON file
-- ---------------------------------------------------------------------------
create table public.question_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  language text not null default 'en' check (language in ('en', 'hi')),
  source_file_ref text,
  question_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.question_sets enable row level security;

create policy "question_sets_select_own" on public.question_sets
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "question_sets_insert_own" on public.question_sets
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "question_sets_update_own" on public.question_sets
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "question_sets_delete_own" on public.question_sets
  for delete to authenticated using (owner_id = (select auth.uid()));

create index question_sets_owner_created_idx on public.question_sets (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- questions
-- options: mcq/msq -> jsonb string[]; match -> {"left": string[], "right": string[]}
--   where "right" is ALWAYS a code-side shuffle of the correct mapping.
-- correct: mcq -> jsonb string; msq -> string[]; match -> string[] (right per left)
-- ---------------------------------------------------------------------------
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.question_sets (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('mcq', 'msq', 'match')),
  stem text not null,
  options jsonb,
  correct jsonb not null,
  explanation text,
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  status text not null default 'active' check (status in ('active', 'removed')),
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.questions enable row level security;

create policy "questions_select_own" on public.questions
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "questions_insert_own" on public.questions
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.question_sets s
      where s.id = set_id and s.owner_id = (select auth.uid())
    )
  );
create policy "questions_update_own" on public.questions
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "questions_delete_own" on public.questions
  for delete to authenticated using (owner_id = (select auth.uid()));

create index questions_set_idx on public.questions (set_id);
create index questions_owner_status_idx on public.questions (owner_id, status);

-- ---------------------------------------------------------------------------
-- test_sessions
-- ---------------------------------------------------------------------------
create table public.test_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  question_count int not null,
  correct_count int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.test_sessions enable row level security;

create policy "test_sessions_select_own" on public.test_sessions
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "test_sessions_insert_own" on public.test_sessions
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "test_sessions_update_own" on public.test_sessions
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "test_sessions_delete_own" on public.test_sessions
  for delete to authenticated using (owner_id = (select auth.uid()));

create index test_sessions_owner_started_idx on public.test_sessions (owner_id, started_at desc);

-- ---------------------------------------------------------------------------
-- session_questions: ordered membership of questions in a session.
-- Owner scoping is derived from the parent session.
-- ---------------------------------------------------------------------------
create table public.session_questions (
  session_id uuid not null references public.test_sessions (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  sort_order int not null,
  primary key (session_id, question_id)
);

alter table public.session_questions enable row level security;

create policy "session_questions_select_own" on public.session_questions
  for select to authenticated using (
    exists (
      select 1 from public.test_sessions ts
      where ts.id = session_id and ts.owner_id = (select auth.uid())
    )
  );
create policy "session_questions_insert_own" on public.session_questions
  for insert to authenticated with check (
    exists (
      select 1 from public.test_sessions ts
      where ts.id = session_id and ts.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from public.questions q
      where q.id = question_id and q.owner_id = (select auth.uid())
    )
  );
create policy "session_questions_delete_own" on public.session_questions
  for delete to authenticated using (
    exists (
      select 1 from public.test_sessions ts
      where ts.id = session_id and ts.owner_id = (select auth.uid())
    )
  );

create index session_questions_session_order_idx on public.session_questions (session_id, sort_order);

-- ---------------------------------------------------------------------------
-- attempts
-- ---------------------------------------------------------------------------
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  session_id uuid references public.test_sessions (id) on delete set null,
  selected jsonb,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

alter table public.attempts enable row level security;

create policy "attempts_select_own" on public.attempts
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "attempts_insert_own" on public.attempts
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.questions q
      where q.id = question_id and q.owner_id = (select auth.uid())
    )
  );
create policy "attempts_update_own" on public.attempts
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "attempts_delete_own" on public.attempts
  for delete to authenticated using (owner_id = (select auth.uid()));

-- One attempt per question per session.
create unique index attempts_session_question_uidx on public.attempts (session_id, question_id)
  where session_id is not null;
create index attempts_owner_created_idx on public.attempts (owner_id, created_at desc);
create index attempts_session_idx on public.attempts (session_id);

-- ---------------------------------------------------------------------------
-- Explicit grants: new tables are not auto-exposed to the Data API roles.
-- RLS remains the row-level gate; grants only open the tables to the API.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.question_sets to authenticated;
grant select, insert, update, delete on table public.questions to authenticated;
grant select, insert, update, delete on table public.test_sessions to authenticated;
grant select, insert, update, delete on table public.session_questions to authenticated;
grant select, insert, update, delete on table public.attempts to authenticated;
-- Private bucket for the original import files, one folder per user.
-- Kept in its own migration: storage privileges differ between local and
-- hosted projects, and the app treats the upload as best-effort.

insert into storage.buckets (id, name, public)
values ('imports', 'imports', false)
on conflict (id) do nothing;

create policy "imports_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "imports_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "imports_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "imports_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Folders: optional grouping for question sets. Deleting a folder never
-- deletes sets — question_sets.folder_id falls back to null (Unfiled).

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.folders enable row level security;

create policy "folders_select_own" on public.folders
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "folders_insert_own" on public.folders
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "folders_update_own" on public.folders
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "folders_delete_own" on public.folders
  for delete to authenticated using (owner_id = (select auth.uid()));

-- One folder name per user (case-insensitive) to avoid confusing duplicates.
create unique index folders_owner_name_uidx on public.folders (owner_id, lower(name));
create index folders_owner_created_idx on public.folders (owner_id, created_at);

grant select, insert, update, delete on table public.folders to authenticated;

alter table public.question_sets
  add column folder_id uuid references public.folders (id) on delete set null;

create index question_sets_folder_idx on public.question_sets (folder_id);
-- Folder personalization: a curated colour and icon per folder.

alter table public.folders
  add column color text not null default 'indigo',
  add column icon text not null default 'folder';

alter table public.folders
  add constraint folders_color_check check (
    color in ('indigo', 'blue', 'teal', 'emerald', 'amber', 'rose', 'violet', 'slate')
  ),
  add constraint folders_icon_check check (
    icon in ('folder', 'book', 'landmark', 'globe', 'scroll', 'flask', 'calculator', 'scale', 'leaf', 'brain')
  );
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
-- Subscriptions + hardened profiles.
--
-- 1. profiles carries email (for the admin Users page), subscription_status
--    and subscription_expires_at (reserved for future payment integration).
-- 2. SECURITY FIX: users could previously UPDATE their whole own profile row,
--    including role. Direct updates are now column-restricted to display_name;
--    role/subscription changes go through admin-guarded definer functions.
-- 3. adityaissc7@gmail.com is the designated admin: promoted if the account
--    exists, and auto-promoted on signup.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column email text,
  add column subscription_status text not null default 'free'
    check (subscription_status in ('free', 'active')),
  add column subscription_expires_at timestamptz;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- Designated admin.
update public.profiles p
set role = 'admin'
from auth.users u
where u.id = p.id and lower(u.email) = 'adityaissc7@gmail.com';

-- ---------------------------------------------------------------------------
-- Signup bootstrap: designated admin email, or the very first account.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    case
      when lower(new.email) = 'adityaissc7@gmail.com' then 'admin'
      when exists (select 1 from public.profiles where role = 'admin') then 'user'
      else 'admin'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles access: admins can read every profile; direct updates are limited
-- to display_name at the column level.
-- ---------------------------------------------------------------------------
drop policy "profiles_select_own" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

revoke update on table public.profiles from authenticated;
grant update (display_name) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Admin-guarded subscription switch (definer function, not table access).
-- ---------------------------------------------------------------------------
create function public.admin_set_subscription(target_id uuid, make_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can manage subscriptions';
  end if;
  update public.profiles
  set
    subscription_status = case when make_active then 'active' else 'free' end,
    subscription_expires_at = null
  where id = target_id;
end;
$$;

grant execute on function public.admin_set_subscription(uuid, boolean) to authenticated;
-- Standard Supabase posture: service_role (server-side tooling only — the
-- app never ships it) bypasses RLS but still needs table privileges, which
-- are no longer auto-granted to new tables.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
-- Folder descriptions (shown on library cards) and an admin-guarded role
-- switch so admins can promote/demote from the Users page.

alter table public.folders
  add column description text;

create function public.admin_set_role(target_id uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
begin
  if not public.is_admin() then
    raise exception 'only admins can manage roles';
  end if;

  select u.email into target_email from auth.users u where u.id = target_id;

  -- The designated admin can never be demoted, and admins cannot demote
  -- themselves (prevents locking the product out of administration).
  if not make_admin and lower(coalesce(target_email, '')) = 'adityaissc7@gmail.com' then
    raise exception 'the designated admin cannot be demoted';
  end if;
  if not make_admin and target_id = auth.uid() then
    raise exception 'you cannot demote yourself';
  end if;

  update public.profiles
  set role = case when make_admin then 'admin' else 'user' end
  where id = target_id;
end;
$$;

grant execute on function public.admin_set_role(uuid, boolean) to authenticated;
-- Practice engine: duplicate detection, timed exam sessions, admin-assigned
-- tests, mistake revision, streaks and leaderboard.

-- ---------------------------------------------------------------------------
-- Duplicate detection: a normalised fingerprint of the question stem so the
-- importer can skip questions the bank already has.
-- ---------------------------------------------------------------------------
alter table public.questions add column fingerprint text;
create index questions_fingerprint_idx on public.questions (fingerprint) where status = 'active';

-- ---------------------------------------------------------------------------
-- Assignments: an admin designs a test once and assigns it to everyone, or to
-- named learners.
-- ---------------------------------------------------------------------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  instructions text,
  -- {setIds: uuid[], types: text[], difficulties: text[], count: int}
  config jsonb not null,
  duration_minutes int check (duration_minutes is null or duration_minutes between 1 and 300),
  due_at timestamptz,
  assign_all boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.assignments enable row level security;

create table public.assignment_targets (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (assignment_id, user_id)
);

alter table public.assignment_targets enable row level security;

-- Learners see assignments aimed at them; admins see all.
create policy "assignments_select_visible" on public.assignments
  for select to authenticated using (
    public.is_admin()
    or assign_all
    or exists (
      select 1 from public.assignment_targets t
      where t.assignment_id = id and t.user_id = (select auth.uid())
    )
  );
create policy "assignments_admin_insert" on public.assignments
  for insert to authenticated with check (owner_id = (select auth.uid()) and public.is_admin());
create policy "assignments_admin_update" on public.assignments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "assignments_admin_delete" on public.assignments
  for delete to authenticated using (public.is_admin());

create policy "assignment_targets_select_own" on public.assignment_targets
  for select to authenticated using (public.is_admin() or user_id = (select auth.uid()));
create policy "assignment_targets_admin_insert" on public.assignment_targets
  for insert to authenticated with check (public.is_admin());
create policy "assignment_targets_admin_delete" on public.assignment_targets
  for delete to authenticated using (public.is_admin());

create index assignments_created_idx on public.assignments (created_at desc);
create index assignment_targets_user_idx on public.assignment_targets (user_id);

grant select, insert, update, delete on table public.assignments to authenticated;
grant select, insert, update, delete on table public.assignment_targets to authenticated;

-- ---------------------------------------------------------------------------
-- Timed sessions, session modes, and per-question review flags.
-- ---------------------------------------------------------------------------
alter table public.test_sessions
  add column mode text not null default 'practice'
    check (mode in ('practice', 'mistakes', 'assigned')),
  add column duration_seconds int,
  add column expires_at timestamptz,
  add column assignment_id uuid references public.assignments (id) on delete set null;

create index test_sessions_assignment_idx on public.test_sessions (assignment_id);

-- Exam-style "mark for review" state, per question per session.
alter table public.session_questions
  add column marked boolean not null default false;

create policy "session_questions_update_own" on public.session_questions
  for update to authenticated using (
    exists (
      select 1 from public.test_sessions ts
      where ts.id = session_id and ts.owner_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.test_sessions ts
      where ts.id = session_id and ts.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Mistake revision: questions whose MOST RECENT answer in the window was
-- wrong. Oldest mistakes first — a question missed a week ago has had time to
-- fade, so re-testing it is worth more than one missed minutes ago.
-- security invoker: RLS keeps this to the caller's own attempts.
-- ---------------------------------------------------------------------------
create function public.my_mistake_questions(days int default 7, max_count int default 25)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select latest.question_id
  from (
    select distinct on (a.question_id)
      a.question_id, a.is_correct, a.created_at
    from public.attempts a
    where a.owner_id = auth.uid()
      and a.created_at > now() - make_interval(days => greatest(days, 1))
    order by a.question_id, a.created_at desc
  ) latest
  join public.questions q on q.id = latest.question_id and q.status = 'active'
  where latest.is_correct = false
  order by latest.created_at asc
  limit greatest(max_count, 1);
$$;

grant execute on function public.my_mistake_questions(int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Streak: consecutive days (ending today or yesterday) with a finished test.
-- ---------------------------------------------------------------------------
create function public.my_streak()
returns table (current_streak int, longest_streak int, active_days int, tested_today boolean)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  days date[];
  today date := current_date;
  cur int := 0;
  longest int := 0;
  run int := 0;
  i int;
begin
  select coalesce(array_agg(d order by d desc), '{}')
  into days
  from (
    select distinct (completed_at at time zone 'UTC')::date as d
    from public.test_sessions
    where owner_id = auth.uid() and completed_at is not null
  ) s;

  active_days := coalesce(array_length(days, 1), 0);
  tested_today := active_days > 0 and days[1] = today;

  -- Current streak only counts if the most recent activity is today or
  -- yesterday, so a broken habit reads as zero rather than a stale number.
  if active_days > 0 and (days[1] = today or days[1] = today - 1) then
    cur := 1;
    for i in 2..active_days loop
      exit when days[i] <> days[i - 1] - 1;
      cur := cur + 1;
    end loop;
  end if;

  if active_days > 0 then
    run := 1;
    longest := 1;
    for i in 2..active_days loop
      if days[i] = days[i - 1] - 1 then
        run := run + 1;
      else
        run := 1;
      end if;
      longest := greatest(longest, run);
    end loop;
  end if;

  current_streak := cur;
  longest_streak := longest;
  return next;
end;
$$;

grant execute on function public.my_streak() to authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard: aggregates only. security definer so learners can be ranked
-- against each other without any access to another person's raw sessions.
-- ---------------------------------------------------------------------------
create function public.leaderboard(days int default 7, max_rows int default 50)
returns table (
  user_id uuid,
  display_name text,
  tests_taken int,
  questions_answered int,
  average_score numeric,
  best_score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    coalesce(nullif(trim(p.display_name), ''), 'Learner') as display_name,
    count(s.id)::int as tests_taken,
    coalesce(sum(s.question_count), 0)::int as questions_answered,
    round(avg(s.correct_count::numeric * 100 / nullif(s.question_count, 0)), 1) as average_score,
    round(max(s.correct_count::numeric * 100 / nullif(s.question_count, 0)), 1) as best_score
  from public.profiles p
  join public.test_sessions s
    on s.owner_id = p.id
   and s.completed_at is not null
   and s.question_count > 0
   and (days <= 0 or s.completed_at > now() - make_interval(days => days))
  group by p.id, p.display_name
  order by average_score desc nulls last, tests_taken desc
  limit greatest(max_rows, 1);
$$;

grant execute on function public.leaderboard(int, int) to authenticated;
-- AI-written explanation and exam tip per question. Generated once by an
-- admin and cached here, so learners never wait on (or pay for) a model call.

alter table public.questions
  add column ai_explanation text,
  add column ai_tip text,
  add column ai_model text,
  add column ai_generated_at timestamptz;

-- Cheap lookup for "how many still need generating" in a set.
create index questions_needs_ai_idx on public.questions (set_id)
  where ai_explanation is null and status = 'active';
-- Study engine: spaced repetition, BPSC-style marking, topic analytics,
-- bookmarks, personal notes and daily targets.

-- ---------------------------------------------------------------------------
-- Spaced repetition. One row per learner per question, holding which Leitner
-- box the question is in and when it is next due. Scheduling itself lives in
-- application code (src/lib/review/schedule.ts) so it can be unit tested.
-- ---------------------------------------------------------------------------
create table public.review_state (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  -- 0 = new/lapsed, rising through the interval ladder as recall succeeds.
  box int not null default 0 check (box between 0 and 5),
  reps int not null default 0,
  lapses int not null default 0,
  due_on date not null default current_date,
  last_correct boolean,
  last_seen_at timestamptz not null default now(),
  primary key (owner_id, question_id)
);

alter table public.review_state enable row level security;

create policy "review_state_select_own" on public.review_state
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "review_state_insert_own" on public.review_state
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "review_state_update_own" on public.review_state
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "review_state_delete_own" on public.review_state
  for delete to authenticated using (owner_id = (select auth.uid()));

create index review_state_due_idx on public.review_state (owner_id, due_on);

grant select, insert, update, delete on table public.review_state to authenticated;

-- ---------------------------------------------------------------------------
-- Bookmarks and personal notes, also per learner per question.
-- ---------------------------------------------------------------------------
create table public.question_notes (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  bookmarked boolean not null default false,
  note text,
  updated_at timestamptz not null default now(),
  primary key (owner_id, question_id)
);

alter table public.question_notes enable row level security;

create policy "question_notes_select_own" on public.question_notes
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "question_notes_insert_own" on public.question_notes
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "question_notes_update_own" on public.question_notes
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "question_notes_delete_own" on public.question_notes
  for delete to authenticated using (owner_id = (select auth.uid()));

create index question_notes_bookmarked_idx on public.question_notes (owner_id)
  where bookmarked;

grant select, insert, update, delete on table public.question_notes to authenticated;

-- ---------------------------------------------------------------------------
-- Question metadata: topic for weak-area analytics, and previous-year exam
-- provenance, which BPSC aspirants prioritise heavily.
-- ---------------------------------------------------------------------------
alter table public.questions
  add column topic text,
  add column exam_year int check (exam_year is null or exam_year between 1900 and 2100),
  add column exam_name text;

create index questions_topic_idx on public.questions (topic) where status = 'active';
create index questions_year_idx on public.questions (exam_year) where status = 'active';

-- ---------------------------------------------------------------------------
-- Marking scheme on a session. BPSC prelims deducts a third of a mark per
-- wrong answer, so practising without it trains the wrong guessing instinct.
-- ---------------------------------------------------------------------------
alter table public.test_sessions
  add column negative_marking numeric(4, 3) not null default 0
    check (negative_marking >= 0 and negative_marking <= 1),
  add column wrong_count int not null default 0;

-- A learner's own daily goal. Profile updates are column-granted (never a
-- blanket update grant) so that role can never be self-assigned; the new
-- column has to be granted explicitly for the same reason.
alter table public.profiles
  add column daily_target int not null default 0 check (daily_target between 0 and 500);

grant update (daily_target) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Questions due for review today (or overdue), oldest due first. Questions
-- never seen are not included: the review queue is for consolidating what you
-- have already met.
-- ---------------------------------------------------------------------------
create function public.my_due_questions(max_count int default 25)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select r.question_id
  from public.review_state r
  join public.questions q on q.id = r.question_id and q.status = 'active'
  where r.owner_id = auth.uid()
    and r.due_on <= current_date
  order by r.due_on asc, r.box asc
  limit greatest(max_count, 1);
$$;

grant execute on function public.my_due_questions(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Accuracy per topic, for directing revision. Counts the learner's most
-- recent answer to each question so re-drilling a question does not let an
-- early mistake drag a topic down forever.
-- ---------------------------------------------------------------------------
create function public.my_topic_accuracy(days int default 0)
returns table (topic text, answered int, correct int, accuracy numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with latest as (
    select distinct on (a.question_id)
      a.question_id, a.is_correct
    from public.attempts a
    where a.owner_id = auth.uid()
      and (days <= 0 or a.created_at > now() - make_interval(days => days))
    order by a.question_id, a.created_at desc
  )
  select
    coalesce(nullif(trim(q.topic), ''), 'Untagged') as topic,
    count(*)::int as answered,
    count(*) filter (where latest.is_correct)::int as correct,
    round(100.0 * count(*) filter (where latest.is_correct) / nullif(count(*), 0), 1) as accuracy
  from latest
  join public.questions q on q.id = latest.question_id
  group by 1
  order by accuracy asc nulls last, answered desc;
$$;

grant execute on function public.my_topic_accuracy(int) to authenticated;
-- Batches: group learners into cohorts so admins can assign tests per batch.
-- Every new user picks a batch at signup; admins can manage batches and see
-- learners grouped by batch.

-- ---------------------------------------------------------------------------
-- batches table
-- ---------------------------------------------------------------------------
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.batches enable row level security;

create policy "batches_select_all" on public.batches
  for select to authenticated using (true);
create policy "batches_admin_insert" on public.batches
  for insert to authenticated with check (public.is_admin());
create policy "batches_admin_update" on public.batches
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "batches_admin_delete" on public.batches
  for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on table public.batches to authenticated;

-- Seed the default batch.
insert into public.batches (name, description)
values ('BPSC 73 English Batch', 'Default batch for BPSC 73rd combined exam preparation — English medium.');

-- ---------------------------------------------------------------------------
-- Add batch_id to profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column batch_id uuid references public.batches (id) on delete set null;

-- Set all existing users to the default batch.
update public.profiles
set batch_id = (select id from public.batches where name = 'BPSC 73 English Batch');

-- Grant column-level update on batch_id so learners can pick their batch.
grant update (batch_id) on public.profiles to authenticated;

create index profiles_batch_idx on public.profiles (batch_id);

-- ---------------------------------------------------------------------------
-- Add batch_id to assignments so tests can target a batch
-- ---------------------------------------------------------------------------
alter table public.assignments
  add column batch_id uuid references public.batches (id) on delete set null;

-- Update the assignment visibility policy: learners also see assignments
-- targeted at their batch.
drop policy "assignments_select_visible" on public.assignments;
create policy "assignments_select_visible" on public.assignments
  for select to authenticated using (
    public.is_admin()
    or assign_all
    or exists (
      select 1 from public.assignment_targets t
      where t.assignment_id = id and t.user_id = (select auth.uid())
    )
    or (
      batch_id is not null
      and exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.batch_id = assignments.batch_id
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Update handle_new_user to accept batch_id from metadata
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_batch_id uuid;
  user_batch_id uuid;
begin
  -- Resolve batch: prefer the one passed in metadata, fall back to default.
  user_batch_id := nullif(trim(new.raw_user_meta_data ->> 'batch_id'), '')::uuid;
  if user_batch_id is null then
    select id into default_batch_id from public.batches where name = 'BPSC 73 English Batch';
    user_batch_id := default_batch_id;
  end if;

  insert into public.profiles (id, display_name, role, batch_id)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    case
      when lower(new.email) = 'adityaissc7@gmail.com' then 'admin'
      when exists (select 1 from public.profiles where role = 'admin') then 'user'
      else 'admin'
    end,
    user_batch_id
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ─── 20260928000001_telegram ────────────────────────────────────────

create table public.telegram_subscribers (
  id         uuid        default gen_random_uuid() primary key,
  chat_id    text        unique not null,
  username   text,
  subscribed boolean     default true not null,
  created_at timestamptz default now() not null
);

alter table public.telegram_subscribers enable row level security;

grant select, insert, update on public.telegram_subscribers to anon;
grant select on public.telegram_subscribers to authenticated;

create policy "anon_manage_subscribers"
  on public.telegram_subscribers for all to anon
  using (true) with check (true);

create policy "authenticated_read_subscribers"
  on public.telegram_subscribers for select to authenticated
  using (true);

grant select on public.questions to anon;

create policy "anon_read_active_questions"
  on public.questions for select to anon
  using (status = 'active');

create table public.telegram_config (
  key   text primary key,
  value text not null
);

alter table public.telegram_config enable row level security;

grant select, insert, update on public.telegram_config to anon;

create policy "anon_manage_config"
  on public.telegram_config for all to anon
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Telegram account linking
-- ---------------------------------------------------------------------------
alter table public.telegram_subscribers
  add column user_id uuid references auth.users(id);

create unique index telegram_subscribers_user_id_idx
  on public.telegram_subscribers(user_id) where user_id is not null;

grant update on public.telegram_subscribers to authenticated;

create policy "users_update_own_subscriber"
  on public.telegram_subscribers for update to authenticated
  using (user_id = auth.uid())
  with check (true);

create table public.telegram_link_codes (
  code       text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now() not null
);

alter table public.telegram_link_codes enable row level security;

grant select, insert, delete on public.telegram_link_codes to authenticated;

create policy "users_manage_own_codes"
  on public.telegram_link_codes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, delete on public.telegram_link_codes to anon;

create policy "anon_consume_codes"
  on public.telegram_link_codes for select to anon
  using (true);

create policy "anon_delete_codes"
  on public.telegram_link_codes for delete to anon
  using (true);

-- Admin-controlled batch membership.
--
-- profiles_update_own only ever covered a learner's own row, so an admin had
-- no way to move somebody between batches — a wrong pick at signup was
-- permanent. This adds the same admin-guarded definer function already used
-- for roles (admin_set_role) and subscriptions (admin_set_subscription).
--
-- The learner-facing column grant is withdrawn at the same time: assignments
-- target batches, so self-service switching let a learner leave a batch to
-- shed an assignment. Signup still sets batch_id through handle_new_user(),
-- which is security definer and unaffected by the grant.

create function public.admin_set_batch(target_id uuid, new_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can move learners between batches';
  end if;
  if new_batch_id is not null
     and not exists (select 1 from public.batches where id = new_batch_id) then
    raise exception 'batch not found';
  end if;
  update public.profiles set batch_id = new_batch_id where id = target_id;
end;
$$;

grant execute on function public.admin_set_batch(uuid, uuid) to authenticated;

revoke update (batch_id) on table public.profiles from authenticated;

-- Explicit "not attempted" (option E) state, per question per session.
--
-- BPSC's notice of 2 May 2026 added a fifth option to every MCQ paper: E
-- means "not attempted", selecting it is mandatory when you skip, and leaving
-- all five blank costs 1/3 — the same as a wrong answer. The app has no OMR
-- sheet, so an in-app skip is scored as 0 either way; this column exists so a
-- learner can practise the habit of resolving every question, and so the
-- runner can warn about the ones left genuinely untouched before submission.
--
-- session_questions already carries a table-level grant and an update policy
-- scoped to the owning session, so the new column needs neither.

alter table public.session_questions
  add column not_attempted boolean not null default false;

-- Let the signup page list batches.
--
-- The batch picker on /signup has never rendered. The page server-renders for
-- a visitor who is, by definition, not yet authenticated, but the only select
-- policy on batches is scoped `to authenticated` — so the query came back
-- empty, the form's `batches.length > 0` guard hid the field, and every
-- signup silently fell through to the name-matched default inside
-- handle_new_user(). Verified against the live project: an anonymous
-- GET /rest/v1/batches returns 200 with an empty array.
--
-- Only active batches are exposed, and only the columns the picker renders.
-- These names are already public by design — they are the options in a
-- dropdown on a logged-out page.

create policy "batches_select_anon" on public.batches
  for select to anon using (is_active);

grant select (id, name, is_active) on public.batches to anon;

-- Auto-close abandoned tests.
--
-- An unfinished session stays "Resume"-able forever, so History fills with
-- tests nobody intends to go back to and the dashboard offers to continue one
-- from weeks ago. Anything untouched for three days is abandoned in practice.
--
-- Closing scores it exactly as finishSession does: unanswered questions count
-- zero, the same as a real exam where you leave the hall. Staleness is
-- measured from the LAST activity, not from the start, so a long test someone
-- answered yesterday is left alone.
--
-- security definer with an owner_id filter rather than an is_admin() guard:
-- every learner needs to tidy their own history, and nobody should be able to
-- close anybody else's test. The filter, not the caller's role, is what makes
-- this safe.

create function public.close_my_stale_sessions(stale_days int default 3)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_count int;
  me uuid := (select auth.uid());
begin
  if me is null then
    return 0;
  end if;

  with stale as (
    select s.id
    from public.test_sessions s
    where s.owner_id = me
      and s.completed_at is null
      and greatest(
            s.started_at,
            coalesce(
              (select max(a.created_at) from public.attempts a where a.session_id = s.id),
              s.started_at
            )
          ) < now() - make_interval(days => greatest(stale_days, 1))
  ),
  tallied as (
    select
      st.id,
      count(a.id) filter (where a.is_correct)     as correct,
      count(a.id) filter (where not a.is_correct) as wrong
    from stale st
    left join public.attempts a on a.session_id = st.id
    group by st.id
  )
  update public.test_sessions s
     set completed_at  = now(),
         correct_count = t.correct,
         wrong_count   = t.wrong
    from tallied t
   where s.id = t.id;

  get diagnostics closed_count = row_count;
  return closed_count;
end;
$$;

grant execute on function public.close_my_stale_sessions(int) to authenticated;

-- The staleness scan walks a learner's unfinished sessions only.
create index if not exists test_sessions_open_owner_idx
  on public.test_sessions (owner_id, started_at)
  where completed_at is null;

-- Exam tracks, so one account can prepare for more than one exam.
--
-- A learner sitting BPSC and UPSC wants to switch context, not keep two
-- logins. Exams sit above the existing hierarchy:
--
--   exams -> folders -> question_sets -> questions
--
-- exam_id lands on BOTH folders and question_sets rather than folders alone,
-- because a set may be unfiled and the test builder still has to know which
-- exam it belongs to. The set's own column is the authoritative one; when a
-- set sits in a folder the app keeps the two in step on import and on move.
--
-- Deletes are restricted, not cascaded: an exam holding folders or sets has
-- to be emptied first. Cascading here would make one click capable of
-- destroying an entire curated library.

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.exams enable row level security;

-- Readable by everyone signed in: a learner cannot switch between tracks
-- they are not allowed to see. Anonymous visitors see active ones so the
-- signup page can offer a choice later.
create policy "exams_select_all" on public.exams
  for select to authenticated using (true);
create policy "exams_select_anon" on public.exams
  for select to anon using (is_active);

create policy "exams_admin_insert" on public.exams
  for insert to authenticated with check (public.is_admin());
create policy "exams_admin_update" on public.exams
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "exams_admin_delete" on public.exams
  for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on table public.exams to authenticated;
grant select (id, name, description, is_active, sort_order) on table public.exams to anon;

-- Everything that exists today is BPSC.
insert into public.exams (name, description, sort_order)
values ('BPSC', 'Bihar Public Service Commission', 0);

alter table public.folders
  add column exam_id uuid references public.exams (id) on delete restrict;
alter table public.question_sets
  add column exam_id uuid references public.exams (id) on delete restrict;

update public.folders
   set exam_id = (select id from public.exams where name = 'BPSC')
 where exam_id is null;
update public.question_sets
   set exam_id = (select id from public.exams where name = 'BPSC')
 where exam_id is null;

create index folders_exam_idx on public.folders (exam_id);
create index question_sets_exam_idx on public.question_sets (exam_id);

-- Which track the learner is currently looking at. Unlike batch_id this is
-- safe to let people set themselves: it scopes what content they see, and
-- carries none of the assignment-targeting weight that made self-service
-- batch switching a way to shed an assigned paper.
alter table public.profiles
  add column active_exam_id uuid references public.exams (id) on delete set null;

update public.profiles
   set active_exam_id = (select id from public.exams where name = 'BPSC')
 where active_exam_id is null;

grant update (active_exam_id) on table public.profiles to authenticated;

-- BPSC Mains writing practice.
--
-- Descriptive answers are a different shape from the objective bank: no
-- options, a word target, marks out of a paper total, and an examiner's
-- report rather than a right/wrong verdict. They get their own tables
-- instead of being forced into `questions`, whose every consumer assumes a
-- gradeable option list.
--
-- Answers are submitted as photographs of a handwritten sheet, because that
-- is the exam. The pipeline transcribes first and lets the candidate correct
-- the transcription before marking, so an OCR misread never costs marks an
-- examiner would not have taken.

-- ---------------------------------------------------------------------------
-- Pattern config. BPSC changes its pattern often — the essay paper only
-- arrived with the 67th — so marks, word targets and timings are rows an
-- admin can edit, not constants that need a deploy.
-- ---------------------------------------------------------------------------
create table public.mains_pattern (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  is_active boolean not null default false,
  -- { "LONG": { "marks": [38], "words": 450, "minutes": 18 }, ... }
  types jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.mains_pattern enable row level security;

create policy "mains_pattern_select_all" on public.mains_pattern
  for select to authenticated using (true);
create policy "mains_pattern_admin_write" on public.mains_pattern
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on table public.mains_pattern to authenticated;

insert into public.mains_pattern (version, is_active, types) values (
  '72nd', true,
  '{
     "SHORT_SUB": { "marks": [7, 8],   "words": 150, "minutes": 5  },
     "LONG":      { "marks": [38],     "words": 450, "minutes": 18 },
     "SEC3_LONG": { "marks": [38, 34], "words": 400, "minutes": 18 },
     "ESSAY":     { "marks": [100],    "words": 800, "minutes": 55 }
   }'::jsonb
);

-- ---------------------------------------------------------------------------
-- Questions. Shared-read, admin-write, like the objective bank — except a
-- learner may add their own, which is why `source` and `created_by` exist.
-- ---------------------------------------------------------------------------
create table public.mains_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.exams (id) on delete restrict,
  source text not null default 'PYQ' check (source in ('PYQ', 'USER', 'MOCK')),
  -- Free text rather than a year alone: "70th BPSC" is how candidates refer
  -- to a paper, and cycle number and calendar year do not line up.
  exam_label text,
  exam_year int check (exam_year between 1990 and 2100),
  paper text not null check (paper in ('GS1', 'GS2', 'ESSAY')),
  section int check (section between 1 and 3),
  -- Decides which rubric marks it. LONG is the 38-mark staple, SHORT_SUB the
  -- 7-8 mark sub-parts of the compulsory Q1, ESSAY the 100-mark papers.
  type text not null check (type in ('LONG', 'SHORT_SUB', 'SEC3_LONG', 'ESSAY', 'CUSTOM')),
  marks int not null check (marks between 1 and 300),
  word_limit int check (word_limit between 50 and 2000),
  -- BPSC prints bilingual papers and candidates may answer in either.
  text_en text,
  text_hi text,
  -- The directive verb decides what a correct answer even looks like, and
  -- 30% of the mark rides on whether the candidate obeyed it.
  directive text,
  -- True only when the question explicitly asks about Bihar. It changes a
  -- marking rule: a missing Bihar dimension then also caps "demand", because
  -- part of the question is simply unanswered.
  bihar_angle boolean not null default false,
  topic text,
  tags text[] not null default '{}',
  -- Q1 of Sections 1 and 2 is one compulsory question split into sub-parts;
  -- this hangs those sub-parts off their parent.
  parent_question_id uuid references public.mains_questions (id) on delete cascade,
  model_answer text,
  model_answer_language text check (model_answer_language in ('en', 'hi')),
  model_answer_model text,
  model_answer_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint mains_questions_has_text check (text_en is not null or text_hi is not null)
);

alter table public.mains_questions enable row level security;

-- Curated questions are visible to everyone; a learner's own are private to
-- them, so one person's practice question does not appear in everybody's bank.
create policy "mains_questions_select_visible" on public.mains_questions
  for select to authenticated using (
    source <> 'USER' or created_by = (select auth.uid()) or public.is_admin()
  );
create policy "mains_questions_insert" on public.mains_questions
  for insert to authenticated with check (
    (public.is_admin() and source <> 'USER')
    or (source = 'USER' and created_by = (select auth.uid()))
  );
create policy "mains_questions_update" on public.mains_questions
  for update to authenticated using (
    public.is_admin() or (source = 'USER' and created_by = (select auth.uid()))
  ) with check (
    public.is_admin() or (source = 'USER' and created_by = (select auth.uid()))
  );
create policy "mains_questions_delete" on public.mains_questions
  for delete to authenticated using (
    public.is_admin() or (source = 'USER' and created_by = (select auth.uid()))
  );

grant select, insert, update, delete on table public.mains_questions to authenticated;

create index mains_questions_exam_paper_idx on public.mains_questions (exam_id, paper, section);
create index mains_questions_year_idx on public.mains_questions (exam_year);
create index mains_questions_parent_idx on public.mains_questions (parent_question_id);
create index mains_questions_mine_idx on public.mains_questions (created_by)
  where source = 'USER';

-- ---------------------------------------------------------------------------
-- Attempts. Per learner, private.
-- ---------------------------------------------------------------------------
create table public.mains_answers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.mains_questions (id) on delete cascade,
  -- Storage paths under the 'answers' bucket, in page order.
  image_paths text[] not null default '{}',
  -- Vision calls on several pages take tens of seconds, which is why the
  -- pipeline is staged rather than one request.
  status text not null default 'UPLOADED'
    check (status in ('UPLOADED', 'TRANSCRIBED', 'EVALUATED', 'FAILED')),
  failure_reason text,
  -- What the vision model read, then what the candidate corrected it to.
  -- Marking always runs on transcript_final: the candidate owns the text
  -- they are judged on.
  transcript_raw text,
  transcript_final text,
  word_count int not null default 0,
  -- How much the vision pass could not read. A high count is why an
  -- evaluation should be treated with suspicion, so it travels with it.
  illegible_count int not null default 0,
  language text check (language in ('en', 'hi', 'mixed')),
  legibility_note text,
  time_taken_sec int,
  -- study: the model answer was readable before writing, so the score
  -- measures recall and is excluded from tracked marks. test: locked until
  -- submission.
  mode text not null default 'test' check (mode in ('study', 'test')),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.mains_answers enable row level security;

create policy "mains_answers_select_own" on public.mains_answers
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "mains_answers_insert_own" on public.mains_answers
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "mains_answers_update_own" on public.mains_answers
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "mains_answers_delete_own" on public.mains_answers
  for delete to authenticated using (owner_id = (select auth.uid()));

grant select, insert, update, delete on table public.mains_answers to authenticated;

create index mains_answers_owner_idx on public.mains_answers (owner_id, created_at desc);
create index mains_answers_question_idx on public.mains_answers (question_id);

-- ---------------------------------------------------------------------------
-- Evaluations. One row per marking run; re-marking keeps the history so a
-- candidate sees movement rather than only the latest number.
-- ---------------------------------------------------------------------------
create table public.mains_evaluations (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.mains_answers (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  -- Recomputed server-side from the per-criterion marks; whatever total the
  -- model reported is discarded, because a total that disagrees with its own
  -- breakdown leaves a candidate unable to tell which number is real.
  marks_awarded numeric(5,1) not null,
  marks_max int not null,
  percent numeric(5,1) not null,
  band text not null check (band in ('POOR', 'BELOW_AVG', 'AVERAGE', 'GOOD', 'EXCELLENT')),
  criteria jsonb not null default '[]'::jsonb,
  demand_analysis jsonb not null default '[]'::jsonb,
  directive_followed boolean,
  bihar_dimension jsonb,
  strengths jsonb not null default '[]'::jsonb,
  mistakes jsonb not null default '[]'::jsonb,
  missed_points jsonb not null default '[]'::jsonb,
  suggested_structure jsonb not null default '[]'::jsonb,
  improved_intro text,
  improved_conclusion text,
  diagram_suggestion text,
  presentation_note text,
  next_action text,
  -- The whole model reply, for diagnosing a bad mark after the fact.
  raw jsonb,
  model text,
  created_at timestamptz not null default now()
);

alter table public.mains_evaluations enable row level security;

create policy "mains_evaluations_select_own" on public.mains_evaluations
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "mains_evaluations_insert_own" on public.mains_evaluations
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "mains_evaluations_delete_own" on public.mains_evaluations
  for delete to authenticated using (owner_id = (select auth.uid()));

grant select, insert, delete on table public.mains_evaluations to authenticated;

create index mains_evaluations_answer_idx on public.mains_evaluations (answer_id, created_at desc);
create index mains_evaluations_owner_idx on public.mains_evaluations (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Answer sheet images. Private, one folder per user, same shape as 'imports'.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('answers', 'answers', false)
on conflict (id) do nothing;

create policy "answers_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'answers' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "answers_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'answers' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "answers_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'answers' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'answers' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "answers_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'answers' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Performance. Study-mode attempts are excluded on purpose: the model answer
-- was readable before writing, so the score measures recall.
-- ---------------------------------------------------------------------------
create function public.my_mains_progress()
returns table (
  paper text,
  section int,
  attempts int,
  avg_percent numeric,
  best_percent numeric,
  avg_minutes numeric,
  last_attempt timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.paper,
    q.section,
    count(distinct a.id)::int as attempts,
    round(avg(e.percent), 1) as avg_percent,
    round(max(e.percent), 1) as best_percent,
    round(avg(a.time_taken_sec) / 60.0, 1) as avg_minutes,
    max(a.submitted_at) as last_attempt
  from public.mains_answers a
  join public.mains_questions q on q.id = a.question_id
  join public.mains_evaluations e on e.answer_id = a.id
  where a.owner_id = (select auth.uid())
    and a.mode = 'test'
    and a.submitted_at is not null
  group by q.paper, q.section
  order by q.paper, q.section;
$$;

grant execute on function public.my_mains_progress() to authenticated;

-- Which rubric criterion loses the most marks — the heatmap behind "you lose
-- 60% of your Bihar marks", which is the single most actionable number here.
create function public.my_mains_criteria()
returns table (
  criterion_key text,
  awarded numeric,
  max_marks numeric,
  percent numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.value ->> 'key' as criterion_key,
    sum((c.value ->> 'awarded')::numeric) as awarded,
    sum((c.value ->> 'max')::numeric) as max_marks,
    round(
      sum((c.value ->> 'awarded')::numeric) * 100
        / nullif(sum((c.value ->> 'max')::numeric), 0),
      1
    ) as percent
  from public.mains_evaluations e
  join public.mains_answers a on a.id = e.answer_id
  cross join lateral jsonb_array_elements(e.criteria) as c(value)
  where e.owner_id = (select auth.uid())
    and a.mode = 'test'
  group by c.value ->> 'key'
  order by percent asc nulls last;
$$;

grant execute on function public.my_mains_criteria() to authenticated;

-- Whether a stored question carries the exam's exact wording.
--
-- A compiled PYQ bank is usually paraphrased from coaching compilations
-- rather than transcribed from the official paper. The difference matters to
-- a candidate: they memorise question phrasing, and a directive verb that
-- was changed in paraphrasing changes what a correct answer looks like.
-- Labelling it is the honest alternative to either hiding the provenance or
-- withholding the bank until every question is verified.

alter table public.mains_questions
  add column wording_status text not null default 'original'
    check (wording_status in ('original', 'paraphrased'));

comment on column public.mains_questions.wording_status is
  'original = exact wording from the official paper; paraphrased = faithful restatement, shown to learners with a caveat.';

-- BPSC Mains PYQ bank, 64th-71st. Generated from bpsc_mains_pyq_bank.json
-- by the same parser the app's importer uses, so the two cannot diverge.
-- Idempotent: clears the PYQ rows for this exam first, leaving learners'
-- own questions and every attempt untouched.

delete from public.mains_questions
 where source = 'PYQ'
   and exam_id = (select id from public.exams where name = 'BPSC');

insert into public.mains_questions
  (exam_id, source, exam_label, exam_year, paper, section,
   type, marks, word_limit, text_en, text_hi, directive, bihar_angle,
   topic, tags, wording_status)
values
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'LONG', 38, null,
  'Analyse the political, economic and social causes of the 1857 Revolt and critically assess Bihar''s contribution to it.', null, 'analyse', true,
  'Modern History > 1857 Revolt', ARRAY['1857-revolt','bihar']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Indian Councils Act, 1909.', null, 'write short note', false,
  'Modern History > Constitutional Acts', ARRAY['constitutional-acts']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'LONG', 38, null,
  'Discuss the transition of the national movement from constitutional agitation to mass mobilisation, highlighting Bihar''s role.', null, 'discuss', true,
  'Modern History > National Movement > Phases', ARRAY['bihar','national-movement','phases']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Birsa Munda movement. (Also asked: 68th short, 66th long)', null, 'write short note', true,
  'Modern History > Tribal Movements > Birsa Munda', ARRAY['bihar','birsa-munda','tribal-movements']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on Jayaprakash Narayan and the Quit India Movement. (Also asked: 66th)', null, 'write short note', true,
  'Modern History > Quit India > JP', ARRAY['bihar','jp','quit-india']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the impact of Western education in Bihar, 1858–1914. (Also asked: 65th, 67th)', null, 'write short note', true,
  'Modern History > Education > Bihar', ARRAY['bihar','education']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'LONG', 38, null,
  'Examine the main features of Nehru''s foreign policy and how far it reflected idealism versus pragmatism.', null, 'examine', false,
  'Modern History > Nehru > Foreign Policy', ARRAY['foreign-policy','nehru']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on Tagore''s contribution to Indian culture. (Also asked: 67th)', null, 'write short note', false,
  'Indian Culture > Tagore', ARRAY['tagore']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'LONG', 38, null,
  'Analyse the main features of Mauryan art and architecture and assess how far they expressed political and cultural values.', null, 'analyse', false,
  'Indian Culture > Mauryan Art', ARRAY['mauryan-art']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on Pala art of Eastern India. (Also asked: 65th long, with Buddhism)', null, 'write short note', true,
  'Indian Culture > Pala Art', ARRAY['bihar','pala-art']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Indian Councils Act, 1861.', null, 'write short note', false,
  'Modern History > Constitutional Acts', ARRAY['constitutional-acts']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'LONG', 38, null,
  'Explain to what extent British policies were responsible for the rise of the Indian National Movement.', null, 'explain', false,
  'Modern History > Rise of Nationalism', ARRAY['rise-of-nationalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Santhal Uprising. (Also asked: 69th short, 66th long, 63rd)', null, 'write short note', true,
  'Modern History > Tribal Movements > Santhal', ARRAY['bihar','santhal','tribal-movements']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'LONG', 38, null,
  'Describe the Champaran Indigo Movement and explain its effect on the freedom struggle. (Also asked: 69th long and short, 67th, 66th, 64th, 63rd)', null, 'describe', true,
  'Modern History > Gandhian Era > Champaran', ARRAY['bihar','champaran','gandhian-era']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'LONG', 38, null,
  'Assess Mahatma Gandhi''s constructive programme.', null, 'assess', false,
  'Modern History > Gandhian Era > Constructive Programme', ARRAY['constructive-programme','gandhian-era']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on Bihar''s role in the Quit India Movement.', null, 'write short note', true,
  'Modern History > Quit India > Bihar', ARRAY['bihar','quit-india']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'LONG', 38, null,
  'Examine the spread of Western education in Bihar from the mid-nineteenth century onwards.', null, 'examine', true,
  'Modern History > Education > Bihar', ARRAY['bihar','education']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the art and architecture of the Mauryan age. (Also asked: 69th, 67th, 64th long)', null, 'write short note', false,
  'Indian Culture > Mauryan Art', ARRAY['mauryan-art']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 1,
  'SHORT_SUB', 7, null,
  'Write a short note on the Patna Kalam school of painting. (Also asked: 68th short, 66th long)', null, 'write short note', true,
  'Indian Culture > Painting > Patna Kalam', ARRAY['bihar','painting','patna-kalam']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Indian Councils Act, 1892.', null, 'write short note', false,
  'Modern History > Constitutional Acts', ARRAY['constitutional-acts']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 1,
  'LONG', 38, null,
  'Critically examine the contribution of the Moderate phase of the Indian National Congress.', null, 'critically examine', false,
  'Modern History > INC > Moderates', ARRAY['inc','moderates']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 1,
  'LONG', 38, null,
  'Trace the development of modern education in Bihar and its impact.', null, 'trace', true,
  'Modern History > Education > Bihar', ARRAY['bihar','education']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on ancient cave paintings of Eastern India.', null, 'write short note', false,
  'Indian Culture > Cave Paintings', ARRAY['cave-paintings']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 1,
  'LONG', 38, null,
  'Explain in detail Bihar''s position as a centre of learning and spirituality since ancient times.', null, 'explain', true,
  'Indian Culture > Bihar > Centres of Learning', ARRAY['bihar','centres-of-learning']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Government of India Act, 1858.', null, 'write short note', false,
  'Modern History > Constitutional Acts', ARRAY['constitutional-acts']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 1,
  'LONG', 38, null,
  'Discuss the factors behind the emergence of the national movement and how it gave direction to the freedom struggle.', null, 'discuss', false,
  'Modern History > Rise of Nationalism', ARRAY['rise-of-nationalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Indigo Revolt.', null, 'write short note', false,
  'Modern History > Peasant Movements > Indigo', ARRAY['indigo','peasant-movements']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 1,
  'LONG', 38, null,
  'Discuss the growth of colonial technical education in Bihar under British schemes and critically analyse its impact.', null, 'discuss', true,
  'Modern History > Education > Technical > Bihar', ARRAY['bihar','education','technical']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 1,
  'LONG', 38, null,
  'Describe Rabindranath Tagore''s ideas on society and culture.', null, 'describe', false,
  'Indian Culture > Tagore', ARRAY['tagore']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the development of caves in ancient Eastern India.', null, 'write short note', false,
  'Indian Culture > Caves', ARRAY['caves']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 1,
  'LONG', 38, null,
  'Analyse the development of temples in ancient North India.', null, 'analyse', false,
  'Indian Culture > Temple Architecture', ARRAY['temple-architecture']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS1', 1,
  'LONG', 38, null,
  'Discuss the factors that led to the formation of the INC and the British attitude towards early nationalists.', null, 'discuss', false,
  'Modern History > INC > Formation', ARRAY['formation','inc']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS1', 1,
  'LONG', 38, null,
  'Critically analyse how Gandhi emerged as a national leader.', null, 'critically analyse', false,
  'Modern History > Gandhian Era > Rise of Gandhi', ARRAY['gandhian-era','rise-of-gandhi']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS1', 1,
  'LONG', 38, null,
  'Discuss the Quit India Movement of 1942, including whether it was spontaneous.', null, 'discuss', false,
  'Modern History > Quit India', ARRAY['quit-india']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on Gandhi''s concept of Satyagraha.', null, 'write short note', false,
  'Modern History > Gandhian Era > Satyagraha', ARRAY['gandhian-era','satyagraha']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on Subhas Chandra Bose and the INA.', null, 'write short note', false,
  'Modern History > Bose & INA', ARRAY['bose-ina']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS1', 1,
  'LONG', 38, null,
  'Discuss Nehru''s views on communalism and secularism. (Also asked: 64th short)', null, 'discuss', false,
  'Modern History > Nehru > Secularism', ARRAY['nehru','secularism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS1', 1,
  'LONG', 38, null,
  'Explain the causes of the Revolt of 1857 and its effect on Bihar.', null, 'explain', true,
  'Modern History > 1857 Revolt', ARRAY['1857-revolt','bihar']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a note on Swami Sahajanand Saraswati and the Kisan Sabha movement.', null, 'write short note', true,
  'Modern History > Peasant Movements > Kisan Sabha', ARRAY['bihar','kisan-sabha','peasant-movements']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on Gandhi''s views on caste and religion.', null, 'write short note', false,
  'Modern History > Gandhian Era > Social Ideas', ARRAY['gandhian-era','social-ideas']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the Dalit movement in Bihar.', null, 'write short note', true,
  'Modern History > Social Movements > Bihar', ARRAY['bihar','social-movements']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS1', 1,
  'LONG', 38, null,
  'Explain the social and economic ideas of Ram Manohar Lohia and Jayaprakash Narayan.', null, 'explain', false,
  'Modern History > Thinkers > Lohia & JP', ARRAY['lohia-jp','thinkers']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS1', 1,
  'LONG', 38, null,
  'Critically examine the evolution of Indian nationalism from the late nineteenth century.', null, 'critically examine', false,
  'Modern History > Rise of Nationalism', ARRAY['rise-of-nationalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS1', 1,
  'LONG', 38, null,
  'Examine the common features of nineteenth-century tribal movements and analyse why they failed.', null, 'examine', false,
  'Modern History > Tribal Movements', ARRAY['tribal-movements']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS1', 1,
  'LONG', 38, null,
  'Discuss nineteenth-century overseas migration with special reference to indentured labour from Bihar.', null, 'discuss', true,
  'Modern History > Indentured Labour > Bihar', ARRAY['bihar','indentured-labour']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the impact of the 1881 Census on caste and religious identity.', null, 'write short note', false,
  'Modern History > Society > Census', ARRAY['census','society']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS1', 1,
  'SHORT_SUB', 8, null,
  'Write a short note on the working class and the national movement.', null, 'write short note', false,
  'Modern History > Working Class', ARRAY['working-class']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Anti-immigration trends in Western democracies. (Title only — verify wording)', null, 'write short note', false,
  'Current Affairs > Global Politics > Migration', ARRAY['global-politics','migration']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'India–Afghanistan relations. (Title only — verify wording)', null, 'write short note', false,
  'Current Affairs > IR > India–Afghanistan', ARRAY['india-afghanistan','ir']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Aspirational Districts Programme and decentralisation. (Title only — verify wording)', null, 'write short note', false,
  'Current Affairs > Governance > Aspirational Districts', ARRAY['aspirational-districts','governance']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Online Gaming Regulation Bill, 2025. (Title only — verify wording)', null, 'write short note', false,
  'Current Affairs > Governance > Online Gaming', ARRAY['governance','online-gaming']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'WHO concerns over drug-safety regulation in India. (Title only — verify wording)', null, 'write short note', false,
  'Current Affairs > Health > Drug Regulation', ARRAY['drug-regulation','health']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Three years into the Russia–Ukraine war, explain its causes and its effects on world politics. (Also asked: 67th, with impact on India)', null, 'discuss', false,
  'Current Affairs > IR > Russia–Ukraine', ARRAY['ir','russia-ukraine']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Analyse the likely national and international course of the US under the newly elected President Trump.', null, 'analyse', false,
  'Current Affairs > IR > USA', ARRAY['ir','usa']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Discuss the direction of opposition unity and coalition politics, and why AAP lost the 2025 Delhi Assembly election.', null, 'discuss', false,
  'Current Affairs > Elections', ARRAY['elections']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Explain in detail the need for and importance of the caste-based census in Bihar.', null, 'explain', true,
  'Current Affairs > Society > Caste Census', ARRAY['bihar','caste-census','society']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'LONG', 38, null,
  'With reference to Uttarakhand adopting a UCC first, explain its social, cultural, religious and legal implications with examples. (Also asked: 69th)', null, 'explain', false,
  'Current Affairs > Polity > UCC', ARRAY['polity','ucc']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'LONG', 38, null,
  'Discuss the constitutional provisions on President''s Rule, why it was imposed in Manipur, and evaluate its effectiveness today.', null, 'discuss', false,
  'Current Affairs > Polity > President''s Rule', ARRAY['polity','president-s-rule']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'LONG', 38, null,
  'Discuss One Nation One Election and its effect on federalism; analyse the pros and cons of simultaneous polls. (Also asked: 67th)', null, 'discuss', false,
  'Current Affairs > Polity > One Nation One Election', ARRAY['one-nation-one-election','polity']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'LONG', 38, null,
  'Analyse women''s political participation and the changes expected from the Women''s Reservation Act, 2023.', null, 'analyse', false,
  'Current Affairs > Polity > Women''s Reservation', ARRAY['polity','women-s-reservation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Explain with examples how Maha Kumbh 2025 symbolised Indian culture, faith and social harmony.', null, 'explain', false,
  'Current Affairs > Culture > Maha Kumbh', ARRAY['culture','maha-kumbh']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'LONG', 38, null,
  'Examine how India''s G-20 presidency reflects the idea of Vasudhaiva Kutumbakam.', null, 'examine', false,
  'Current Affairs > Intl Orgs > G-20', ARRAY['g-20','intl-orgs']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Explain the Supreme Court''s concern about combating gender stereotypes.', null, 'explain', false,
  'Current Affairs > Judiciary > Gender', ARRAY['gender','judiciary']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Examine the relevance of the Bharatiya Nagarik Suraksha Sanhita, 2023 to governance.', null, 'examine', false,
  'Current Affairs > Criminal Law Reform', ARRAY['criminal-law-reform']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Evaluate the role of AI in decision-making by legislative institutions.', null, 'evaluate', false,
  'Current Affairs > Governance > AI', ARRAY['ai','governance']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'LONG', 38, null,
  'Give an overview of the Manipur crisis and comment on its possible repercussions for national politics.', null, 'comment', false,
  'Current Affairs > Internal Security > Manipur', ARRAY['internal-security','manipur']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Describe the parameters and findings of the ILO Global Wage Report 2022–23.', null, 'describe', false,
  'Current Affairs > Economy > Reports', ARRAY['economy','reports']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'State the main provisions of Foreign Trade Policy 2023 for export promotion.', null, 'state', false,
  'Current Affairs > Economy > Trade Policy', ARRAY['economy','trade-policy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 2,
  'LONG', 38, null,
  'Discuss how India''s rise as a space power matches its ambitions, citing Chandrayaan-3.', null, 'discuss', false,
  'Current Affairs > S&T > Chandrayaan-3', ARRAY['chandrayaan-3','s-t']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'LONG', 38, null,
  'Should India reclaim leadership of the developing world through its G-20 presidency? Can it unite the Global South despite its own challenges? Give arguments.', null, 'argue', false,
  'Current Affairs > Intl Orgs > G-20 & Global South', ARRAY['g-20-global-south','intl-orgs']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'LONG', 38, null,
  'Evaluate the UN''s role in access and resource management after the Syria–Turkey earthquake.', null, 'evaluate', false,
  'Current Affairs > Intl Orgs > UN', ARRAY['intl-orgs','un']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Explain the mandate of the UN Public Administration Network under SDG-16.', null, 'explain', false,
  'Current Affairs > Intl Orgs > UN & SDG-16', ARRAY['intl-orgs','un-sdg-16']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'LONG', 38, null,
  'Explain the UGC draft rules on foreign university campuses, their prospects, and whether they will be a game-changer.', null, 'explain', false,
  'Current Affairs > Education > UGC Foreign Campuses', ARRAY['education','ugc-foreign-campuses']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'LONG', 38, null,
  'Critically examine the basic-structure doctrine in light of recent criticism by the Vice-President, and whether it risks an executive–judiciary clash.', null, 'critically examine', false,
  'Current Affairs > Polity > Basic Structure', ARRAY['basic-structure','polity']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Discuss rights-based e-service delivery in Bihar.', null, 'discuss', true,
  'Current Affairs > Bihar > e-Governance', ARRAY['bihar','e-governance']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Describe Bihar''s efforts in solar power generation.', null, 'describe', true,
  'Current Affairs > Bihar > Solar Energy', ARRAY['bihar','solar-energy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'Critically examine the features of Bihar''s Saat Nischay-2 (2020–25) programme.', null, 'critically examine', true,
  'Current Affairs > Bihar > Saat Nischay-2', ARRAY['bihar','saat-nischay-2']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS1', 2,
  'SHORT_SUB', 8, null,
  'State where the 18th National Scouts & Guides Jamboree was held and describe its objectives.', null, 'describe', false,
  'Current Affairs > National Events', ARRAY['national-events']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS1', 2,
  'LONG', 38, null,
  'Discuss the significance of QUAD for India.', null, 'discuss', false,
  'Current Affairs > IR > QUAD', ARRAY['ir','quad']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS1', 2,
  'LONG', 38, null,
  'Comment on whether the Agnipath scheme means development or destruction.', null, 'comment', false,
  'Current Affairs > Defence > Agnipath', ARRAY['agnipath','defence']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS1', 2,
  'LONG', 38, null,
  'Do you agree that ruling parties misuse constitutional institutions? Discuss.', null, 'discuss', false,
  'Current Affairs > Polity > Constitutional Institutions', ARRAY['constitutional-institutions','polity']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Hospital admissions table by department and gender: find highest female share, inter-department ratios, departments above one-quarter of admissions, and revised ratios after value changes.', null, 'calculate', false,
  'Statistics > Data Interpretation > Table', ARRAY['data-interpretation','table']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Graph of over-60 population by state, rural/urban and sex: find highest proportions, urban-to-rural and male-to-female ratios.', null, 'calculate', false,
  'Statistics > Data Interpretation > Graph', ARRAY['data-interpretation','graph']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'NEET/JEE qualifiers across seven states: compute totals and inter-state ratios.', null, 'calculate', false,
  'Statistics > Data Interpretation > Bar/Pie', ARRAY['bar-pie','data-interpretation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Married and divorced population of seven towns (graph + table): find unknowns, project 10%/5% changes, approximate ratio.', null, 'calculate', false,
  'Statistics > Data Interpretation > Mixed', ARRAY['data-interpretation','mixed']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Candidates appeared, qualified and selected in five states over several years: best average, highest qualified/appeared and selected/appeared percentages, ratios.', null, 'calculate', false,
  'Statistics > Data Interpretation > Table', ARRAY['data-interpretation','table']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Bar diagram of paddy, wheat and maize output: ratio of totals, share percentage, average as percentage, change needed, percentage-change scenario.', null, 'calculate', false,
  'Statistics > Data Interpretation > Bar', ARRAY['bar','data-interpretation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Pie charts of spending by two families: combined totals, one head as percentage of another, effect of percentage rises, cut needed to offset.', null, 'calculate', false,
  'Statistics > Data Interpretation > Pie', ARRAY['data-interpretation','pie']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Line graph of exports of three firms: steepest annual rise, highest percentage growth, ratios after growth, back-calculation to an earlier year.', null, 'calculate', false,
  'Statistics > Data Interpretation > Line', ARRAY['data-interpretation','line']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Table of soap units and prices for three firms: average price, percentage fall, market share, peak year, gap between maximum and minimum.', null, 'calculate', false,
  'Statistics > Data Interpretation > Table', ARRAY['data-interpretation','table']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Pie chart of calculator manufacturing costs: central angle, cost price and marked price from shares, profit percentage.', null, 'calculate', false,
  'Statistics > Data Interpretation > Pie', ARRAY['data-interpretation','pie']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Two pie charts of family spending at different incomes: differences, ratios, sector angle, combined totals.', null, 'calculate', false,
  'Statistics > Data Interpretation > Pie', ARRAY['data-interpretation','pie']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS1', 3,
  'SEC3_LONG', 36, null,
  'Bar graph of a state''s additional tax over several years: percentage rise and fall, peak growth year, average, smallest decline.', null, 'calculate', false,
  'Statistics > Data Interpretation > Bar', ARRAY['bar','data-interpretation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Describe the main features and significance of the 42nd Amendment Act, 1976.', null, 'describe', false,
  'Polity > Amendment > 42nd Amendment', ARRAY['42nd-amendment','amendment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'LONG', 38, null,
  'Can Parliament, using Article 368, destroy the basic structure of the Constitution? Discuss.', null, 'discuss', false,
  'Polity > Basic Structure > Article 368', ARRAY['article-368','basic-structure']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'LONG', 38, null,
  'Critically analyse the concept of constitutional morality as developed by the Supreme Court.', null, 'critically analyse', false,
  'Polity > Constitutional Morality', ARRAY['constitutional-morality']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'LONG', 38, null,
  'Explore where cultural and constitutional nationalism meet, and the basic features of cultural understanding under the Constitution.', null, 'explore', false,
  'Polity > Nationalism', ARRAY['nationalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'State the main role of the Finance Commission and the Article under which it is constituted.', null, 'state', false,
  'Polity > Finance Commission', ARRAY['finance-commission']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'LONG', 38, null,
  'Analyse how the multi-party system affects federal stability. Have coalitions strengthened or weakened cooperative and competitive federalism?', null, 'analyse', false,
  'Polity > Federalism > Coalitions', ARRAY['coalitions','federalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Give your views on the debate over supremacy between Parliament and the Judiciary.', null, 'give views', false,
  'Polity > Judiciary > Parliament vs Judiciary', ARRAY['judiciary','parliament-vs-judiciary']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Explain writ jurisdiction and name any three of the five writs.', null, 'explain', false,
  'Polity > Judiciary > Writs', ARRAY['judiciary','writs']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Define judicial review and state its basic purpose.', null, 'define', false,
  'Polity > Judiciary > Judicial Review', ARRAY['judicial-review','judiciary']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Explain why Article 32 is called the heart and soul of the Constitution.', null, 'explain', false,
  'Polity > Fundamental Rights > Article 32', ARRAY['article-32','fundamental-rights']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'LONG', 38, null,
  'Explain the political and constitutional changes in Jammu and Kashmir after the abrogation of Article 370.', null, 'explain', false,
  'Polity > J&K > Article 370', ARRAY['article-370','j-k']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'LONG', 38, null,
  'Examine the Governor as a link between Centre and State. Can the Governor act on personal discretion?', null, 'examine', false,
  'Polity > Governor', ARRAY['governor']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'What is the collegium system? Why is it criticised? Give your views.', null, 'explain', false,
  'Polity > Judiciary > Collegium', ARRAY['collegium','judiciary']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Discuss how the 73rd and 74th Amendments have empowered women at the grassroots in Bihar.', null, 'discuss', true,
  'Polity > Local Government > Women', ARRAY['bihar','local-government','women']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'LONG', 38, null,
  'Trace the evolution from one-party dominance to coalitions. Has coalition politics weakened the Prime Minister''s authority?', null, 'trace', false,
  'Polity > Party System > Coalitions', ARRAY['coalitions','party-system']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Is caste now more a political than a social phenomenon in India? Give reasons.', null, 'analyse', false,
  'Polity > Caste & Politics', ARRAY['caste-politics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Analyse the criminalisation of politics and politicisation of criminals in the Bihar context.', null, 'analyse', true,
  'Polity > Criminalisation of Politics', ARRAY['bihar','criminalisation-of-politics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 1,
  'LONG', 38, null,
  'Language is both a medium of communication and a symbol of identity. Analyse the political impact of linguistic identity.', null, 'analyse', false,
  'Polity > Linguistic Identity', ARRAY['linguistic-identity']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Critically examine the basic structure doctrine of the Constitution.', null, 'critically examine', false,
  'Polity > Basic Structure', ARRAY['basic-structure']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Explain how the Preamble serves as a blueprint of constitutional goals.', null, 'explain', false,
  'Polity > Preamble', ARRAY['preamble']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Critically describe the amendment process of the Constitution.', null, 'critically describe', false,
  'Polity > Amendment', ARRAY['amendment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Is reservation for Economically Weaker Sections justified? Comment.', null, 'comment', false,
  'Polity > Reservation > EWS', ARRAY['ews','reservation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'Critically examine Indian federalism as a balance between cultural diversity and a larger national community.', null, 'critically examine', false,
  'Polity > Federalism > Diversity', ARRAY['diversity','federalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'Discuss the institutional relationship between the President and the Prime Minister and how their roles are changing.', null, 'discuss', false,
  'Polity > President & PM', ARRAY['president-pm']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'Evaluate the role of local government in empowering Panchayats and urban bodies, with grassroots examples from Bihar.', null, 'evaluate', true,
  'Polity > Local Government > Bihar', ARRAY['bihar','local-government']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'Discuss the basic principles of coalition politics in Bihar with respect to national interest.', null, 'discuss', true,
  'Polity > Coalition Politics > Bihar', ARRAY['bihar','coalition-politics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Describe how the caste census will influence Bihar''s politics.', null, 'describe', true,
  'Polity > Caste Census > Bihar', ARRAY['bihar','caste-census']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 7, null,
  'Explain with examples how the Directive Principles act as a charter of social and economic democracy.', null, 'explain', false,
  'Polity > DPSP', ARRAY['dpsp']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Critically analyse the dynamic nature of secularism in India.', null, 'critically analyse', false,
  'Polity > Secularism', ARRAY['secularism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'Critically examine the nature and working of Zonal Councils in light of the paramountcy of national interest.', null, 'critically examine', false,
  'Polity > Federalism > Zonal Councils', ARRAY['federalism','zonal-councils']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'Discuss the composition and powers of the Rajya Sabha and its role as the second chamber.', null, 'discuss', false,
  'Polity > Parliament > Rajya Sabha', ARRAY['parliament','rajya-sabha']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 7, null,
  'Explain the judicial review jurisdiction of the Supreme Court.', null, 'explain', false,
  'Polity > Judiciary > Judicial Review', ARRAY['judicial-review','judiciary']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'Critically examine the Election Commission''s role in free and fair elections, with reference to Bihar before and after T.N. Seshan.', null, 'critically examine', true,
  'Polity > Election Commission', ARRAY['bihar','election-commission']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Explain the role of regional politics in India.', null, 'explain', false,
  'Polity > Regionalism', ARRAY['regionalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'SHORT_SUB', 8, null,
  'Bihar''s political culture has improved in recent decades. Illustrate with examples.', null, 'illustrate', true,
  'Polity > Political Culture > Bihar', ARRAY['bihar','political-culture']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 1,
  'LONG', 38, null,
  'How has the role of caste in politics changed over the decades? Does development dilute caste?', null, 'discuss', false,
  'Polity > Caste & Politics', ARRAY['caste-politics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 1,
  'LONG', 38, null,
  'Discuss Centre–State relations with reference to Bihar and how cooperative federalism can address the problems.', null, 'discuss', true,
  'Polity > Federalism > Centre–State Relations', ARRAY['bihar','centre-state-relations','federalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 1,
  'LONG', 38, null,
  'Is Parliament sovereign? Comment on its vast but not unlimited powers, comparing it with the British Parliament.', null, 'comment', false,
  'Polity > Parliament > Sovereignty', ARRAY['parliament','sovereignty']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 1,
  'LONG', 38, null,
  'Has judicial activism added to the powers of the Supreme Court? Illustrate with examples.', null, 'discuss', false,
  'Polity > Judiciary > Judicial Activism', ARRAY['judicial-activism','judiciary']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 1,
  'LONG', 38, null,
  'Explain why regional parties emerged. Do they serve regional aspirations and national unity?', null, 'explain', false,
  'Polity > Party System > Regional Parties', ARRAY['party-system','regional-parties']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 1,
  'LONG', 38, null,
  'Explain why India''s federal structure is tilted towards the Centre.', null, 'explain', false,
  'Polity > Federalism', ARRAY['federalism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 1,
  'LONG', 38, null,
  'Uneven development among states creates socio-economic and political problems. Critically analyse with special reference to Bihar.', null, 'critically analyse', true,
  'Polity > Federalism > Regional Disparity', ARRAY['bihar','federalism','regional-disparity']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 1,
  'LONG', 38, null,
  'Evaluate the comparison of the President to a family elder whose advice may be ignored.', null, 'evaluate', false,
  'Polity > President', ARRAY['president']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 1,
  'LONG', 38, null,
  'Discuss whether Parliament is an effective forum for national integration.', null, 'discuss', false,
  'Polity > Parliament > National Integration', ARRAY['national-integration','parliament']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 1,
  'LONG', 38, null,
  'Does the Constitution give Fundamental Rights with one hand and take them back with the other? Discuss.', null, 'discuss', false,
  'Polity > Fundamental Rights', ARRAY['fundamental-rights']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 1,
  'LONG', 38, null,
  'The Indian Parliament is a non-sovereign law-making body. Evaluate.', null, 'evaluate', false,
  'Polity > Parliament > Sovereignty', ARRAY['parliament','sovereignty']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 1,
  'LONG', 38, null,
  'Indian political parties are individualistic rather than nationalistic. Explain with reference to Bihar.', null, 'explain', true,
  'Polity > Party System', ARRAY['bihar','party-system']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 1,
  'LONG', 38, null,
  'What is e-governance? Discuss its implementation in Bihar.', null, 'discuss', true,
  'Polity > e-Governance > Bihar', ARRAY['bihar','e-governance']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 1,
  'LONG', 38, null,
  'Identify the constitutional provisions that give effect to the Preamble''s ideals of a socialist, secular, democratic republic.', null, 'identify', false,
  'Polity > Preamble', ARRAY['preamble']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 1,
  'LONG', 38, null,
  'Critically examine the Governor''s role in state politics, especially in Bihar. Is the Governor merely a puppet?', null, 'critically examine', true,
  'Polity > Governor', ARRAY['bihar','governor']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 1,
  'LONG', 38, null,
  'Comment on judicial activism in Indian governance, with arguments for and against.', null, 'comment', false,
  'Polity > Judiciary > Judicial Activism', ARRAY['judicial-activism','judiciary']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 1,
  'LONG', 38, null,
  'Too many political parties are the bane of Indian politics. Explain in the context of Bihar.', null, 'explain', true,
  'Polity > Party System', ARRAY['bihar','party-system']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Describe how natural resource management, inclusive development and e-technology help achieve Atmanirbhar and Viksit Bharat.', null, 'describe', false,
  'Economy > Development Strategy', ARRAY['development-strategy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Discuss the main challenges facing India''s food processing industry and government initiatives for it.', null, 'discuss', false,
  'Economy > Food Processing', ARRAY['food-processing']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'LONG', 38, null,
  'Explain the components of food security and justify with examples how far hydroponics can meet future demand.', null, 'explain', false,
  'Economy > Food Security > Hydroponics', ARRAY['food-security','hydroponics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'LONG', 38, null,
  'Describe the concept of Industry 4.0 and critically analyse its benefits and risks for India.', null, 'critically analyse', false,
  'Economy > Industry 4.0', ARRAY['industry-4-0']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'SHORT_SUB', 7, null,
  'Describe government initiatives in the last ten years for inclusive and sustainable development in South Bihar.', null, 'describe', true,
  'Economy > Regional Development > South Bihar', ARRAY['bihar','regional-development','south-bihar']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'LONG', 38, null,
  'Discuss the railways'' role in national development and critically analyse barriers to rail logistics in the North-East.', null, 'critically analyse', false,
  'Geography > Transport > Railways', ARRAY['railways','transport']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'LONG', 38, null,
  'Discuss the major east-coast ports and critically examine the role of Kolkata''s Syama Prasad Mookerjee Port for the North-East and Bangladesh.', null, 'critically examine', false,
  'Geography > Transport > Ports', ARRAY['ports','transport']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Explain the conditions that favour jute cultivation in West Bengal and Bihar.', null, 'explain', true,
  'Geography > Crops > Jute', ARRAY['bihar','crops','jute']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 2,
  'SHORT_SUB', 7, null,
  'Give an account of the environmental and social benefits of geothermal energy in India, with examples.', null, 'describe', false,
  'Geography > Energy > Geothermal', ARRAY['energy','geothermal']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'SHORT_SUB', 7, null,
  'Discuss the growth of the automobile industry in and around India''s four largest metro regions.', null, 'discuss', false,
  'Geography > Industrial Location > Automobiles', ARRAY['automobiles','industrial-location']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Explain the climatic conditions and mechanism behind winter rainfall in India and where it falls.', null, 'explain', false,
  'Geography > Climate > Winter Rainfall', ARRAY['climate','winter-rainfall']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'LONG', 38, null,
  'Discuss the claim that Peninsular India is richer in rocks and minerals, linking geology with quarrying and mining.', null, 'discuss', false,
  'Geography > Geology & Minerals', ARRAY['geology-minerals']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'LONG', 38, null,
  'Distinguish between alluvial and diluvial soils in formation, characteristics and distribution, with examples.', null, 'distinguish', false,
  'Geography > Soils', ARRAY['soils']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Explain the geographical conditions suitable for India''s major millets, with examples.', null, 'explain', false,
  'Geography > Crops > Millets', ARRAY['crops','millets']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'SHORT_SUB', 7, null,
  'Explain the ecological conditions needed for makhana and government steps to boost its production and marketing.', null, 'explain', true,
  'Geography > Crops > Makhana', ARRAY['bihar','crops','makhana']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Discuss the environmental and economic benefits of India''s coastal mangroves, with examples.', null, 'discuss', false,
  'Geography > Ecosystems > Mangroves', ARRAY['ecosystems','mangroves']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'LONG', 38, null,
  'Examine the ecological and economic benefits of solar energy in India, with examples.', null, 'examine', false,
  'Geography > Energy > Solar', ARRAY['energy','solar']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 2,
  'LONG', 38, null,
  'Discuss the causes and effects of out-migration from Bihar and the state''s steps to address it.', null, 'discuss', true,
  'Geography > Migration > Bihar', ARRAY['bihar','migration']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'LONG', 38, null,
  'Explain the trickle-down theory for Indian planning: its elements, benefits, limits and criticism.', null, 'explain', false,
  'Economy > Planning > Trickle-down', ARRAY['planning','trickle-down']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Discuss the present state and future prospects of Indian tourism.', null, 'discuss', false,
  'Economy > Services > Tourism', ARRAY['services','tourism']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Analyse the mechanism and characteristics of the Indian monsoon.', null, 'analyse', false,
  'Geography > Climate > Monsoon', ARRAY['climate','monsoon']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'LONG', 38, null,
  'Explain the factors shaping Bihar''s climate, its agro-climatic zones, its seasons, and their effect on farming.', null, 'explain', true,
  'Geography > Climate > Bihar Agro-climatic Zones', ARRAY['bihar','bihar-agro-climatic-zones','climate']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Divide India into its major physiographic divisions and describe the one in which Bihar lies.', null, 'describe', true,
  'Geography > Physiography > Bihar', ARRAY['bihar','physiography']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Critically review India''s energy sources, whether they meet domestic needs, and the alternatives.', null, 'critically review', false,
  'Geography > Energy', ARRAY['energy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Describe the distribution of Bihar''s SC/ST population and comment on its socio-economic status.', null, 'describe', true,
  'Geography > Population > Bihar SC/ST', ARRAY['bihar','bihar-sc-st','population']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 2,
  'LONG', 38, null,
  'Explain the classification of cities, Census 2011 population trends by class, and Bihar''s population and working-population trend.', null, 'explain', true,
  'Geography > Population > Urban Classification', ARRAY['bihar','population','urban-classification']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'LONG', 38, null,
  'Classify Bihar''s industries as forest-, agro- and mineral-based, and show their locations on sketch maps.', null, 'classify', true,
  'Geography > Industrial Location > Bihar', ARRAY['bihar','industrial-location']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Explain how the National Logistics Policy 2022 and PM Gati Shakti can transform India''s logistics efficiency.', null, 'explain', false,
  'Economy > Infrastructure > Logistics', ARRAY['infrastructure','logistics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Explain how the Atal Innovation Mission builds innovation and entrepreneurship.', null, 'explain', false,
  'Economy > Innovation > Atal Innovation Mission', ARRAY['atal-innovation-mission','innovation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 7, null,
  'Discuss India''s rural–urban digital divide, its effects, and government steps to narrow it.', null, 'discuss', false,
  'Economy > Digital Divide', ARRAY['digital-divide']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'LONG', 38, null,
  'Examine India''s global trade engagement in 2022 and its trade initiatives, and suggest ways to raise future trade.', null, 'examine', false,
  'Economy > External Sector > Trade', ARRAY['external-sector','trade']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'LONG', 38, null,
  'Bihar''s tele-density is far below the national average; discuss the reasons, the impact, and the remedies.', null, 'discuss', true,
  'Economy > Telecom > Bihar', ARRAY['bihar','telecom']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'LONG', 38, null,
  'Discuss why the blue economy matters for India, the steps taken, and whether they are adequate.', null, 'discuss', false,
  'Economy > Blue Economy', ARRAY['blue-economy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Explain the Indian Ocean Dipole, its link with the erratic 2022 monsoon, and its effects on food output and the economy.', null, 'explain', false,
  'Geography > Climate > Indian Ocean Dipole', ARRAY['climate','indian-ocean-dipole']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 2,
  'SHORT_SUB', 8, null,
  'Discuss Bihar''s low level of urbanisation, give reasons, and describe recent state initiatives.', null, 'discuss', true,
  'Geography > Urbanisation > Bihar', ARRAY['bihar','urbanisation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 2,
  'LONG', 38, null,
  'Compare Bihar''s industrial development with India''s, identify causes of Bihar''s backwardness, and describe recent remedial steps.', null, 'describe', true,
  'Economy > Industry > Bihar', ARRAY['bihar','industry']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 2,
  'LONG', 38, null,
  'Introduce JEEViKA and its objectives, and evaluate its role in empowering women in Bihar.', null, 'evaluate', true,
  'Economy > Rural Livelihoods > JEEViKA', ARRAY['bihar','jeevika','rural-livelihoods']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 2,
  'LONG', 38, null,
  'Given Bihar''s low rank on NITI''s Health Index, state the causes and steps taken, and assess with data whether the steps are enough.', null, 'assess', true,
  'Economy > Health > Bihar', ARRAY['bihar','health']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 2,
  'LONG', 38, null,
  'Name Bihar''s major natural resources, map the distribution of any two, and explain their economic importance.', null, 'explain', true,
  'Geography > Resources > Bihar', ARRAY['bihar','resources']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 2,
  'LONG', 38, null,
  'The Bihar Economic Survey shows Bihar growing faster than India; discuss which sectors drove this growth.', null, 'discuss', true,
  'Economy > Bihar > Sectoral Growth', ARRAY['bihar','sectoral-growth']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 2,
  'LONG', 38, null,
  'Give the causes of socio-economic disparity in Bihar and critically evaluate government measures to reduce it.', null, 'critically evaluate', true,
  'Economy > Bihar > Regional Disparity', ARRAY['bihar','regional-disparity']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 2,
  'LONG', 38, null,
  'Define demographic dividend, state how long India and Bihar can reap it, and describe Bihar''s steps.', null, 'explain', true,
  'Economy > Demography > Bihar', ARRAY['bihar','demography']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 2,
  'LONG', 38, null,
  'Explain how human development is measured, list Bihar''s Saat Nischay commitments, and explain the schemes behind them.', null, 'explain', true,
  'Economy > Human Development > Bihar', ARRAY['bihar','human-development']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 2,
  'LONG', 38, null,
  'Discuss whether economic planning is still relevant after the reforms, and how the state and market can work together.', null, 'discuss', false,
  'Economy > Planning', ARRAY['planning']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 2,
  'LONG', 38, null,
  'Evaluate farm production and productivity trends since 1991, and suggest practical measures to raise them in Bihar.', null, 'evaluate', true,
  'Economy > Agriculture > Bihar', ARRAY['agriculture','bihar']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 2,
  'LONG', 38, null,
  'Give the new definition of MSMEs and critically evaluate their role in industrial growth and Atmanirbhar Bharat.', null, 'critically evaluate', false,
  'Economy > Industry > MSME', ARRAY['industry','msme']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 2,
  'LONG', 38, null,
  'Identify the main obstacles to Bihar''s rapid economic development and explain how to remove them.', null, 'explain', true,
  'Economy > Bihar > Growth Constraints', ARRAY['bihar','growth-constraints']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 2,
  'LONG', 38, null,
  'Evaluate the main achievements of economic planning in India.', null, 'evaluate', false,
  'Economy > Planning', ARRAY['planning']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 2,
  'LONG', 38, null,
  'Examine the claim that economic development cannot be judged properly unless population growth is checked.', null, 'examine', false,
  'Economy > Population & Development', ARRAY['population-development']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 2,
  'LONG', 38, null,
  'Critically examine the need for food security in India.', null, 'critically examine', false,
  'Economy > Food Security', ARRAY['food-security']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain how nanotechnology-based environmental monitoring can address pollution in industrial belts.', null, 'explain', false,
  'S&T > Nanotech > Environment', ARRAY['environment','nanotech']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain how remote-sensing satellites have changed disaster risk reduction, with reference to project NETRA.', null, 'explain', false,
  'S&T > Space > Remote Sensing', ARRAY['remote-sensing','space']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain the role of Jai Anusandhan, Jai Anuprayog in indigenisation and critically assess India''s self-reliance in AI and robotics.', null, 'critically assess', false,
  'S&T > Indigenisation > AI & Robotics', ARRAY['ai-robotics','indigenisation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Examine the institutional, financial and technological barriers to full indigenisation in space, IT and defence.', null, 'examine', false,
  'S&T > Indigenisation', ARRAY['indigenisation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Assess whether Space Policy 2023''s private-sector opening changed security and disaster capacity, and propose a strategy.', null, 'assess', false,
  'S&T > Space > Policy', ARRAY['policy','space']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Analyse social media as a force multiplier for internal security threats and the security-versus-liberty dilemma, and suggest a strategy.', null, 'analyse', false,
  'S&T > Cyber > Internal Security', ARRAY['cyber','internal-security']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Assess how far STEM expansion has narrowed Bihar''s regional education gaps and discuss the digital-divide and teacher-capacity problems.', null, 'assess', true,
  'S&T > Education > STEM', ARRAY['bihar','education','stem']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SHORT_SUB', 6, null,
  'Explain how science and technology raise farm productivity and help preserve food.', null, 'explain', false,
  'S&T > Agri-tech', ARRAY['agri-tech']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SHORT_SUB', 6, null,
  'Explain with examples how drones aid India''s national security.', null, 'explain', false,
  'S&T > Defence > Drones', ARRAY['defence','drones']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss how Chandrayaan and Mangalyaan raised India''s space standing and their uses in farming, disasters and urban planning.', null, 'discuss', false,
  'S&T > Space > Missions', ARRAY['missions','space']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SHORT_SUB', 6, null,
  'Describe how DNA fingerprinting helps forensic science.', null, 'describe', false,
  'S&T > Biotech > DNA Fingerprinting', ARRAY['biotech','dna-fingerprinting']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SHORT_SUB', 6, null,
  'Justify why science and technology are needed everywhere, from cancer treatment to ticket booking.', null, 'justify', false,
  'S&T > General Applications', ARRAY['general-applications']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SHORT_SUB', 6, null,
  'Define cybercrime, list its types, and explain how technology helps reduce it.', null, 'explain', false,
  'S&T > Cyber Crime', ARRAY['cyber-crime']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain Wi-Fi and its contribution to India''s economy, infrastructure and higher education.', null, 'explain', false,
  'S&T > ICT > Wi-Fi', ARRAY['ict','wi-fi']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'GS2', 3,
  'SHORT_SUB', 6, null,
  'Define STEM education and its value for quality schooling in Bihar and the future workforce.', null, 'describe', true,
  'S&T > Education > STEM', ARRAY['bihar','education','stem']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain with examples how misuse of technology has harmed India''s environment.', null, 'explain', false,
  'S&T > Environment', ARRAY['environment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss the role of technology in sustainable development.', null, 'discuss', false,
  'S&T > Sustainable Development', ARRAY['sustainable-development']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss the role of computers in modern society.', null, 'discuss', false,
  'S&T > ICT > Computers', ARRAY['computers','ict']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain with examples the link between technology and social development.', null, 'explain', false,
  'S&T > Tech & Society', ARRAY['tech-society']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss the role of science and technology in Bihar''s industrial development.', null, 'discuss', true,
  'S&T > Industry > Bihar', ARRAY['bihar','industry']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain why India must expand nuclear power and the precautions this requires.', null, 'explain', false,
  'S&T > Nuclear Energy', ARRAY['nuclear-energy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss the government''s role in water conservation for tap water to every home, and the technology Bihar has used toward this goal.', null, 'discuss', true,
  'S&T > Water > Bihar', ARRAY['bihar','water']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain the significance of indigenisation of technology for India.', null, 'explain', false,
  'S&T > Indigenisation', ARRAY['indigenisation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Distinguish the internet from an intranet and explain how they have changed human life.', null, 'explain', false,
  'S&T > ICT', ARRAY['ict']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss cyber-threat areas in the public and government domains and the Centre''s countermeasures.', null, 'discuss', false,
  'S&T > Cyber Security', ARRAY['cyber-security']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Write a note on technology-driven modernisation of Bihar.', null, 'write a note', true,
  'S&T > Bihar > Modernisation', ARRAY['bihar','modernisation']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Justify the statement that technology is more a curse than a blessing in the context of pollution.', null, 'justify', false,
  'S&T > Environment > Pollution', ARRAY['environment','pollution']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss the role of technology in Bihar''s agricultural development for food and nutrition security.', null, 'discuss', true,
  'S&T > Agri-tech > Bihar', ARRAY['agri-tech','bihar']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '67th BPSC', 2022, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Justify with examples that nanotechnology can improve human life. (Also asked: 68th, 69th — in health)', null, 'justify', false,
  'S&T > Nanotech', ARRAY['nanotech']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Justify, from advances in defence technology, that Make in India has strengthened India''s defence capability.', null, 'justify', false,
  'S&T > Defence Technology', ARRAY['defence-technology']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss India''s space research aimed at finding life on other planets.', null, 'discuss', false,
  'S&T > Space > Exploration', ARRAY['exploration','space']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '66th BPSC', 2021, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Describe how India countered Covid-19 in light of Make in India. (Also asked: 69th)', null, 'describe', false,
  'S&T > Health > Covid-19', ARRAY['covid-19','health']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Explain the role of science and technology in forecasting and managing disasters, especially floods and drought in Bihar. (Also asked: 66th, 67th)', null, 'explain', true,
  'S&T > Disaster Management > Bihar', ARRAY['bihar','disaster-management']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss with examples the role of science and technology in driving Make in India.', null, 'discuss', false,
  'S&T > Make in India', ARRAY['make-in-india']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss scientific initiatives addressing population pressure, health risks, resource degradation and shrinking farmland.', null, 'discuss', false,
  'S&T > Health & Resources', ARRAY['health-resources']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '65th BPSC', 2020, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss how science and technology can ease the Covid-19 employment crisis and sustain development.', null, 'discuss', false,
  'S&T > Employment', ARRAY['employment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'India has many rivers yet lacks drinking water; discuss the role of science and technology in water management.', null, 'discuss', false,
  'S&T > Water Management', ARRAY['water-management']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Describe how science and technology can meet rising electricity demand as conventional sources deplete.', null, 'describe', false,
  'S&T > Energy', ARRAY['energy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Give your vision of smart cities and explain the role of science and technology in building them.', null, 'explain', false,
  'S&T > Smart Cities', ARRAY['smart-cities']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '64th BPSC', 2019, 'GS2', 3,
  'SEC3_LONG', 36, null,
  'Discuss the types of waste and how technology can tackle waste from population growth and poor planning.', null, 'discuss', false,
  'S&T > Waste Management', ARRAY['waste-management']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'The power of mindset in shaping human destiny.', null, 'write an essay', false,
  'Essay > Philosophical', ARRAY['philosophical']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'Technology as a double-edged sword: balancing innovation and control.', null, 'write an essay', false,
  'Essay > Technology', ARRAY['technology']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'Ethics in action: why moral courage matters more than opinion.', null, 'write an essay', false,
  'Essay > Ethics', ARRAY['ethics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'Geopolitical implications of rising tensions in the Middle East.', null, 'write an essay', false,
  'Essay > International Relations', ARRAY['international-relations']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'India''s importance in today''s global context.', null, 'write an essay', false,
  'Essay > International Relations', ARRAY['international-relations']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'National development and information technology.', null, 'write an essay', false,
  'Essay > Technology & Development', ARRAY['technology-development']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'Environmental imbalance is the destroyer of creation.', null, 'write an essay', false,
  'Essay > Environment', ARRAY['environment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'Soil conservation and organic farming.', null, 'write an essay', false,
  'Essay > Agriculture & Environment', ARRAY['agriculture-environment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Science and technology help us understand the mysteries of the universe.', null, 'write an essay', false,
  'Essay > Science & Technology', ARRAY['science-technology']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Better farming systems can strengthen the rural economy.', null, 'write an essay', false,
  'Essay > Agriculture', ARRAY['agriculture']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'The black economy is the root of crime and corruption.', null, 'write an essay', false,
  'Essay > Economy & Corruption', ARRAY['economy-corruption']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'The communication revolution has raised public awareness.', null, 'write an essay', false,
  'Essay > Communication', ARRAY['communication']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'A forest grows its own trees; it does not wait for others to sow seeds.', null, 'write an essay', false,
  'Essay > Philosophical', ARRAY['philosophical']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Literature is not just a source of knowledge but a form of moral and social action.', null, 'write an essay', false,
  'Essay > Literature & Society', ARRAY['literature-society']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Do your duty, for action is better than inaction.', null, 'write an essay', false,
  'Essay > Philosophical (Gita)', ARRAY['philosophical-gita']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Good art illuminates experience or reveals truth.', null, 'write an essay', false,
  'Essay > Art', ARRAY['art']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'AI and human values: can machines understand morality?', null, 'write an essay', false,
  'Essay > AI & Ethics', ARRAY['ai-ethics']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'Environmental responsibility in an age of industrial expansion.', null, 'write an essay', false,
  'Essay > Environment', ARRAY['environment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'Love and knowledge: the twin pillars of a meaningful life.', null, 'write an essay', false,
  'Essay > Philosophical', ARRAY['philosophical']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  'De-dollarisation and the changing global economic order.', null, 'write an essay', false,
  'Essay > Global Economy', ARRAY['global-economy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'Political will and national security.', null, 'write an essay', false,
  'Essay > Security & Governance', ARRAY['security-governance']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'End of corruption and upliftment of the nation.', null, 'write an essay', false,
  'Essay > Corruption & Governance', ARRAY['corruption-governance']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'Lax law and order is a hindrance to women''s empowerment.', null, 'write an essay', false,
  'Essay > Women Empowerment', ARRAY['women-empowerment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  'World welfare is impossible without spiritual consciousness.', null, 'write an essay', false,
  'Essay > Philosophical', ARRAY['philosophical']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Women''s empowerment seen through political empowerment.', null, 'write an essay', false,
  'Essay > Women Empowerment', ARRAY['women-empowerment']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Importance of yoga for spiritual, physical and mental development.', null, 'write an essay', false,
  'Essay > Health & Spirituality', ARRAY['health-spirituality']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Pros and cons of the New Education Policy.', null, 'write an essay', false,
  'Essay > Education Policy', ARRAY['education-policy']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Impact of climate change on Indian agriculture and ways to protect it.', null, 'write an essay', false,
  'Essay > Environment & Agriculture', ARRAY['environment-agriculture']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'We are not makers of history; we are made by history.', null, 'write an essay', false,
  'Essay > History', ARRAY['history']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'The internet has turned our world into a global village.', null, 'write an essay', false,
  'Essay > Technology', ARRAY['technology']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Thought is the basis of life.', null, 'write an essay', false,
  'Essay > Philosophical', ARRAY['philosophical']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  'Education seeking change after Covid.', null, 'write an essay', false,
  'Essay > Education', ARRAY['education']::text[], 'paraphrased'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'बाँदर की जानैत अहि अदरक्क स्वाद', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'अधजल घैला छलकैत जाए', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'जेकरा लाठी ओकरा भैंस', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '71st BPSC', 2026, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'अकेला चना भाड़ न फोड़ि सकेला', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'बनले के साथी सब केहू ह अउरी बिगड़ले के केहु नाहीं', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'जिअते माछी नाहीं घोंटाई', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'बापक नाम साग पात आ बेटाक नाम परोर', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '70th BPSC', 2025, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'जइसन बोअबऽ ओइसने कटबऽ', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'बिन समाज के बोली हो सकेला का, बिन बोली समाज हो सकेला का!', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'धोबियक कुकुर ने घर के ने घाट के', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'आगु नाथ ने पाछू पगहा, बिना छान के कूदे गधा', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '69th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'अनेर धुनेर के राम रखवार', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'धर्म के बिना विज्ञान नंगर, विज्ञान के बिना धर्म आन्हर', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'पानी में मछरिया, नौ-नौ कुटिया बखरा', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'अगिला खेती आगे-आगे, पछिला खेती भागे-जागे', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
),
(
  (select id from public.exams where name = 'BPSC'),
  'PYQ', '68th BPSC', 2023, 'ESSAY', null,
  'ESSAY', 100, null,
  null, 'मूस मोटइहें, लोढ़ा होइहें, ना हाथी, ना घोड़ा होइहें', 'write an essay', false,
  'Essay > Proverb', ARRAY['proverb','regional-proverb']::text[], 'original'
);

-- Post-condition check on the PYQ seed.
--
-- The seed resolves exam_id with a subquery; if no exam named 'BPSC' existed
-- it would have inserted 283 rows with a null exam_id, which the app filters
-- on — the bank would be present in the table and invisible in the product.
-- That is exactly the kind of silent half-failure worth turning into a loud
-- one, so this raises rather than letting it pass.

do $$
declare
  total int;
  orphaned int;
  bihar int;
begin
  select count(*) into total
    from public.mains_questions where source = 'PYQ';
  select count(*) into orphaned
    from public.mains_questions where source = 'PYQ' and exam_id is null;
  select count(*) into bihar
    from public.mains_questions where source = 'PYQ' and bihar_angle;

  if total <> 283 then
    raise exception 'PYQ seed: expected 283 rows, found %', total;
  end if;
  if orphaned > 0 then
    raise exception 'PYQ seed: % rows have no exam_id and would be invisible', orphaned;
  end if;
  if bihar <> 63 then
    raise exception 'PYQ seed: expected 63 Bihar-angle rows, found %', bihar;
  end if;

  raise notice 'PYQ seed verified: % rows, % Bihar-angle, 0 orphaned', total, bihar;
end $$;
