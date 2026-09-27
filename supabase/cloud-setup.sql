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
