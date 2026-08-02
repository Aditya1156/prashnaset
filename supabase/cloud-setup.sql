-- PrashnaSet — one-paste schema setup for Supabase Cloud.
-- Generated from supabase/migrations/*.sql (keep those as the source of truth).
--
-- Use this when you can't run `supabase link && supabase db push`:
-- open your project's Dashboard → SQL Editor → New query, paste this whole
-- file, and Run. Safe on a fresh project only — it creates tables from scratch.
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
-- deletes sets â€” question_sets.folder_id falls back to null (Unfiled).

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

