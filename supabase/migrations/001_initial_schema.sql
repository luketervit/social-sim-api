-- Audiences table: stores persona collections
create table if not exists audiences (
  id text primary key,
  name text not null,
  metadata jsonb default '{}'::jsonb,
  personas jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

-- API keys table
create table if not exists api_keys (
  key text primary key,
  email text not null,
  credits int default 100,
  created_at timestamptz default now()
);

-- Simulations table: stores completed simulation results
create table if not exists simulations (
  id uuid primary key default gen_random_uuid(),
  audience_id text references audiences(id),
  platform text not null,
  input text not null,
  thread jsonb not null default '[]'::jsonb,
  aggression_score text,
  created_at timestamptz default now()
);

-- RLS policies
alter table audiences enable row level security;
alter table api_keys enable row level security;
alter table simulations enable row level security;

-- Audiences: public read via anon key
create policy "audiences_read" on audiences
  for select using (true);

-- API keys: insert via anon (key requests from frontend)
create policy "api_keys_insert" on api_keys
  for insert with check (true);

-- API keys: service role can read/update (validation)
create policy "api_keys_service_select" on api_keys
  for select using (true);

create policy "api_keys_service_update" on api_keys
  for update using (true);

-- Simulations: service role insert
create policy "simulations_insert" on simulations
  for insert with check (true);

create policy "simulations_read" on simulations
  for select using (true);
