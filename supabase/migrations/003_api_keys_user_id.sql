-- Link API keys to authenticated users
alter table api_keys add column user_id uuid references auth.users(id);

-- Index for fast lookup by user
create index idx_api_keys_user_id on api_keys(user_id);

-- Update RLS: users can only read their own keys
drop policy if exists "api_keys_service_select" on api_keys;
drop policy if exists "api_keys_insert" on api_keys;
drop policy if exists "api_keys_service_update" on api_keys;

-- Authenticated users can read their own keys
create policy "api_keys_select_own" on api_keys
  for select using (auth.uid() = user_id);

-- Only service role can insert (API route creates keys)
create policy "api_keys_service_insert" on api_keys
  for insert with check (true);

-- Only service role can update (credit decrement)
create policy "api_keys_service_update" on api_keys
  for update using (true);
