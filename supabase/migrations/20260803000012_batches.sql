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
