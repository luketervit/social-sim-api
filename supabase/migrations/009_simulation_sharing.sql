-- Add sharing columns to simulations
alter table simulations
  add column if not exists public boolean not null default false,
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists shared_at timestamptz;

-- Index for public simulation browsing
create index if not exists idx_simulations_public
  on simulations (public, shared_at desc)
  where public = true;

-- Allow anyone to read public simulations (no auth required)
create policy "Public simulations are viewable by anyone"
  on simulations for select
  using (public = true);
