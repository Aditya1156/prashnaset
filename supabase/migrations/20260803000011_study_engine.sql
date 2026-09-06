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
