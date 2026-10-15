-- Explicit "not attempted" (option E) state, per question per session.
--
-- BPSC's notice of 2 May 2026 added a fifth option to every MCQ paper: E
-- means "not attempted", selecting it is mandatory when you skip, and leaving
-- all five blank costs 1/3 — the same as a wrong answer. The app has no OMR
-- sheet, so an in-app skip is scored as 0 either way; this column exists so a
-- learner can practise the habit of resolving every question, and so the
-- runner can warn about the ones left genuinely untouched before submission.
--
-- session_questions already carries a table-level grant and an update policy
-- scoped to the owning session, so the new column needs neither.

alter table public.session_questions
  add column not_attempted boolean not null default false;
