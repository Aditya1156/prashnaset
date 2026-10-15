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
