-- AI-written explanation and exam tip per question. Generated once by an
-- admin and cached here, so learners never wait on (or pay for) a model call.

alter table public.questions
  add column ai_explanation text,
  add column ai_tip text,
  add column ai_model text,
  add column ai_generated_at timestamptz;

-- Cheap lookup for "how many still need generating" in a set.
create index questions_needs_ai_idx on public.questions (set_id)
  where ai_explanation is null and status = 'active';
