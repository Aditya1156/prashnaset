-- Telegram bot subscriber tracking.
-- The webhook runs without auth cookies (Telegram calls us), so the anon
-- role needs direct access.  The data is just chat-IDs and opt-in state —
-- no secrets, no PII beyond a Telegram username.

create table public.telegram_subscribers (
  id         uuid        default gen_random_uuid() primary key,
  chat_id    text        unique not null,
  username   text,
  subscribed boolean     default true not null,
  created_at timestamptz default now() not null
);

alter table public.telegram_subscribers enable row level security;

-- The webhook and cron endpoints run as anon (no user session).
grant select, insert, update on public.telegram_subscribers to anon;
grant select on public.telegram_subscribers to authenticated;

create policy "anon_manage_subscribers"
  on public.telegram_subscribers for all to anon
  using (true) with check (true);

create policy "authenticated_read_subscribers"
  on public.telegram_subscribers for select to authenticated
  using (true);

-- The bot sends questions from the public bank.  Questions are already
-- shared-read for authenticated users; grant the anon role read access
-- so the webhook (which has no user session) can fetch them too.
grant select on public.questions to anon;

create policy "anon_read_active_questions"
  on public.questions for select to anon
  using (status = 'active');

-- Bot config (admin-settable daily count etc.)
create table public.telegram_config (
  key   text primary key,
  value text not null
);

alter table public.telegram_config enable row level security;

grant select, insert, update on public.telegram_config to anon;

create policy "anon_manage_config"
  on public.telegram_config for all to anon
  using (true) with check (true);
