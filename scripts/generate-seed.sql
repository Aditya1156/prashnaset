-- Generates supabase/seed-real-data.sql content: the current content tables
-- (folders, question_sets, questions) as INSERTs whose owner resolves to the
-- adityaissc7@gmail.com profile at run time. Excludes e2e ghosts.

with real_owner as (
  select p.id from public.profiles p where p.email not like '%@prashnaset.test'
),
folder_rows as (
  select string_agg(
    format('(%L, admin_id, %L, %L, %L, %L, %L)',
      f.id, f.name, f.color, f.icon, f.description, f.created_at),
    E',\n    ' order by f.created_at)
  as v
  from public.folders f where f.owner_id in (select id from real_owner)
),
set_rows as (
  select string_agg(
    format('(%L, admin_id, %L, %L, %L, %s, %L)',
      s.id, s.title, s.language, s.folder_id, s.question_count, s.created_at),
    E',\n    ' order by s.created_at)
  as v
  from public.question_sets s where s.owner_id in (select id from real_owner)
),
question_rows as (
  select string_agg(
    format('(%L, admin_id, %L, %L, %L, %L::jsonb, %L::jsonb, %L, %L, %L, %s, %L)',
      q.id, q.set_id, q.type, q.stem, q.options::text, q.correct::text,
      q.explanation, q.difficulty, q.status, q.position, q.created_at),
    E',\n    ' order by q.created_at, q.position)
  as v
  from public.questions q where q.owner_id in (select id from real_owner)
)
select
'-- PrashnaSet: real library content exported from the local database.' || E'\n' ||
'-- PREREQUISITE: the schema (cloud-setup.sql) is applied AND an account for' || E'\n' ||
'-- adityaissc7@gmail.com exists (sign up once on the deployed app).' || E'\n' ||
'-- Safe to re-run: existing rows with the same ids are skipped.' || E'\n\n' ||
'do $seed$' || E'\n' ||
'declare' || E'\n' ||
'  admin_id uuid;' || E'\n' ||
'begin' || E'\n' ||
'  select id into admin_id from public.profiles where lower(email) = ''adityaissc7@gmail.com'';' || E'\n' ||
'  if admin_id is null then' || E'\n' ||
'    raise exception ''Sign up on the deployed app with adityaissc7@gmail.com first, then run this seed.'';' || E'\n' ||
'  end if;' || E'\n\n' ||
'  insert into public.folders (id, owner_id, name, color, icon, description, created_at) values' || E'\n    ' ||
coalesce((select v from folder_rows), '-- (no folders)') || E'\n' ||
'  on conflict (id) do nothing;' || E'\n\n' ||
'  insert into public.question_sets (id, owner_id, title, language, folder_id, question_count, created_at) values' || E'\n    ' ||
coalesce((select v from set_rows), '-- (no sets)') || E'\n' ||
'  on conflict (id) do nothing;' || E'\n\n' ||
'  insert into public.questions (id, owner_id, set_id, type, stem, options, correct, explanation, difficulty, status, position, created_at) values' || E'\n    ' ||
coalesce((select v from question_rows), '-- (no questions)') || E'\n' ||
'  on conflict (id) do nothing;' || E'\n' ||
'end' || E'\n' ||
'$seed$;';
