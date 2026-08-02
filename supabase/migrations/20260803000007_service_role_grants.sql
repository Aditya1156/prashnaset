-- Standard Supabase posture: service_role (server-side tooling only — the
-- app never ships it) bypasses RLS but still needs table privileges, which
-- are no longer auto-granted to new tables.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
