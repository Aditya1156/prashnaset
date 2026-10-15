-- Whether a stored question carries the exam's exact wording.
--
-- A compiled PYQ bank is usually paraphrased from coaching compilations
-- rather than transcribed from the official paper. The difference matters to
-- a candidate: they memorise question phrasing, and a directive verb that
-- was changed in paraphrasing changes what a correct answer looks like.
-- Labelling it is the honest alternative to either hiding the provenance or
-- withholding the bank until every question is verified.

alter table public.mains_questions
  add column wording_status text not null default 'original'
    check (wording_status in ('original', 'paraphrased'));

comment on column public.mains_questions.wording_status is
  'original = exact wording from the official paper; paraphrased = faithful restatement, shown to learners with a caveat.';
