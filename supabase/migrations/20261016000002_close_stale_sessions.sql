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
