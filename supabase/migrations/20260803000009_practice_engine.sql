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
