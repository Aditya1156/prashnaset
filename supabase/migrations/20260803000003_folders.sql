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
