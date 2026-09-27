-- Account linking: let PrashnaSet users connect their Telegram.
-- Deep-link flow: web app generates a code → user opens t.me/bot?start=CODE
-- → webhook matches code to user_id → subscriber row is linked.

alter table public.telegram_subscribers
  add column user_id uuid references auth.users(id);

create unique index telegram_subscribers_user_id_idx
  on public.telegram_subscribers(user_id) where user_id is not null;

-- Authenticated users may update their own subscriber link (disconnect).
grant update on public.telegram_subscribers to authenticated;

create policy "users_update_own_subscriber"
  on public.telegram_subscribers for update to authenticated
  using (user_id = auth.uid())
  with check (true);

-- Temporary link codes (expire after 10 min, cleaned up by the webhook).
create table public.telegram_link_codes (
  code       text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now() not null
);

alter table public.telegram_link_codes enable row level security;

-- Authenticated users manage their own codes.
grant select, insert, delete on public.telegram_link_codes to authenticated;

create policy "users_manage_own_codes"
  on public.telegram_link_codes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Webhook (anon) reads + deletes codes during linking.
grant select, delete on public.telegram_link_codes to anon;

create policy "anon_consume_codes"
  on public.telegram_link_codes for select to anon
  using (true);

create policy "anon_delete_codes"
  on public.telegram_link_codes for delete to anon
  using (true);
