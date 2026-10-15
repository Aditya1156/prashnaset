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
