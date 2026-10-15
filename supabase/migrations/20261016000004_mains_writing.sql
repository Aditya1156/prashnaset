-- BPSC Mains writing practice.
--
-- Descriptive answers are a different shape from the objective bank: no
-- options, a word limit, marks out of a paper total, and an evaluation
-- rather than a right/wrong verdict. They get their own tables instead of
-- being forced into `questions`, whose every consumer assumes a gradeable
-- option list.
--
-- Answers are submitted as photographs of a handwritten sheet, because that
-- is the exam. The pipeline transcribes first and lets the candidate correct
-- the transcription before marking, so an OCR misread never costs marks that
-- an examiner would not have taken.

-- ---------------------------------------------------------------------------
-- Questions. Shared-read, admin-write, exactly like the objective bank.
-- ---------------------------------------------------------------------------
create table public.mains_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.exams (id) on delete restrict,
  paper text not null check (paper in ('gs1', 'gs2', 'essay', 'hindi', 'optional')),
  question text not null,
  -- BPSC long answers run to 38 marks; shorter ones vary by cycle.
  marks int not null check (marks between 1 and 300),
  word_limit int check (word_limit between 50 and 2000),
  -- The directive verb ("examine", "critically analyse") decides what a
  -- correct answer even looks like, so the evaluator is told it explicitly
  -- rather than left to infer it from the question text.
  directive text,
  topic text,
  exam_year int check (exam_year between 1990 and 2100),
  -- Written by an admin or generated once and cached, never per learner.
  model_answer text,
  model_answer_model text,
  model_answer_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.mains_questions enable row level security;

create policy "mains_questions_select_all" on public.mains_questions
  for select to authenticated using (true);
create policy "mains_questions_admin_insert" on public.mains_questions
  for insert to authenticated with check (public.is_admin());
create policy "mains_questions_admin_update" on public.mains_questions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "mains_questions_admin_delete" on public.mains_questions
  for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on table public.mains_questions to authenticated;

create index mains_questions_exam_paper_idx on public.mains_questions (exam_id, paper);
create index mains_questions_year_idx on public.mains_questions (exam_year);

-- ---------------------------------------------------------------------------
-- Attempts. Per learner, private.
-- ---------------------------------------------------------------------------
create table public.mains_answers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.mains_questions (id) on delete cascade,
  -- Storage paths under the 'answers' bucket, in page order.
  image_paths text[] not null default '{}',
  -- What the vision model read, then what the candidate corrected it to.
  -- Marking always runs on transcript_final: the candidate owns the text
  -- they are judged on.
  transcript_raw text,
  transcript_final text,
  word_count int not null default 0,
  -- study: model answer was readable before writing, so the score measures
  -- recall and is excluded from tracked marks. test: locked until submit.
  mode text not null default 'test' check (mode in ('study', 'test')),
  minutes_taken int,
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
-- candidate can see movement rather than just the latest number.
-- ---------------------------------------------------------------------------
create table public.mains_evaluations (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.mains_answers (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  marks_awarded numeric(5,1) not null,
  marks_max int not null,
  -- Per-criterion scores, as returned by the evaluator.
  criteria jsonb not null default '[]'::jsonb,
  verdict text,
  factual_errors jsonb not null default '[]'::jsonb,
  missing_points jsonb not null default '[]'::jsonb,
  next_step text,
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
-- Tracked performance. Study-mode attempts are excluded on purpose: the
-- model answer was readable before writing, so the score measures recall.
-- ---------------------------------------------------------------------------
create function public.my_mains_progress()
returns table (
  paper text,
  attempts int,
  avg_percent numeric,
  best_percent numeric,
  last_attempt timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.paper,
    count(distinct a.id)::int as attempts,
    round(avg(e.marks_awarded * 100 / nullif(e.marks_max, 0)), 1) as avg_percent,
    round(max(e.marks_awarded * 100 / nullif(e.marks_max, 0)), 1) as best_percent,
    max(a.submitted_at) as last_attempt
  from public.mains_answers a
  join public.mains_questions q on q.id = a.question_id
  join public.mains_evaluations e on e.answer_id = a.id
  where a.owner_id = (select auth.uid())
    and a.mode = 'test'
    and a.submitted_at is not null
  group by q.paper
  order by q.paper;
$$;

grant execute on function public.my_mains_progress() to authenticated;
