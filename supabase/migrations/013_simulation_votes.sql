create table if not exists simulation_votes (
  simulation_id uuid not null references simulations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (simulation_id, user_id)
);

create index if not exists simulation_votes_sim_idx
  on simulation_votes(simulation_id);

alter table simulation_votes enable row level security;

drop policy if exists "simulation_votes_select_public" on simulation_votes;
create policy "simulation_votes_select_public" on simulation_votes
  for select using (true);

drop policy if exists "simulation_votes_insert_own" on simulation_votes;
create policy "simulation_votes_insert_own" on simulation_votes
  for insert with check (auth.uid() = user_id);

drop policy if exists "simulation_votes_update_own" on simulation_votes;
create policy "simulation_votes_update_own" on simulation_votes
  for update using (auth.uid() = user_id);

drop policy if exists "simulation_votes_delete_own" on simulation_votes;
create policy "simulation_votes_delete_own" on simulation_votes
  for delete using (auth.uid() = user_id);

-- Aggregated vote counts on simulations table
alter table simulations
  add column if not exists upvotes integer not null default 0,
  add column if not exists downvotes integer not null default 0;

create or replace function public.adjust_simulation_vote_count(
  p_simulation_id uuid,
  p_column text,
  p_delta integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_column = 'upvotes' then
    update public.simulations
      set upvotes = greatest(upvotes + p_delta, 0)
    where id = p_simulation_id;
  elsif p_column = 'downvotes' then
    update public.simulations
      set downvotes = greatest(downvotes + p_delta, 0)
    where id = p_simulation_id;
  else
    raise exception 'invalid column: %', p_column;
  end if;
end;
$$;
