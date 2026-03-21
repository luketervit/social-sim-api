alter table simulations
  add column if not exists public_clicks integer not null default 0;

create table if not exists simulation_public_clicks (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references simulations(id) on delete cascade,
  visitor_id text not null,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

create unique index if not exists simulation_public_clicks_unique_idx
  on simulation_public_clicks (simulation_id, visitor_id);

create index if not exists simulation_public_clicks_simulation_idx
  on simulation_public_clicks (simulation_id, created_at desc);

create table if not exists simulation_share_events (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references simulations(id) on delete cascade,
  channel text not null,
  share_text text,
  destination text,
  created_at timestamptz not null default now()
);

create index if not exists simulation_share_events_simulation_idx
  on simulation_share_events (simulation_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'simulation_share_events_channel_check'
  ) then
    alter table simulation_share_events
      add constraint simulation_share_events_channel_check
      check (
        channel in (
          'published',
          'copy_link',
          'copy_summary',
          'twitter',
          'linkedin',
          'email',
          'direct'
        )
      );
  end if;
end $$;

alter table simulation_public_clicks enable row level security;
alter table simulation_share_events enable row level security;

create or replace function public.record_public_simulation_click(
  p_simulation_id uuid,
  p_visitor_id text,
  p_referrer text default null,
  p_user_agent text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_rows integer := 0;
  current_clicks integer := 0;
begin
  if not exists (
    select 1
    from simulations
    where id = p_simulation_id
      and public = true
  ) then
    raise exception 'Simulation not found';
  end if;

  insert into simulation_public_clicks (
    simulation_id,
    visitor_id,
    referrer,
    user_agent
  )
  values (
    p_simulation_id,
    p_visitor_id,
    nullif(trim(coalesce(p_referrer, '')), ''),
    nullif(trim(coalesce(p_user_agent, '')), '')
  )
  on conflict (simulation_id, visitor_id) do nothing;

  get diagnostics inserted_rows = row_count;

  if inserted_rows > 0 then
    update simulations
    set public_clicks = public_clicks + 1
    where id = p_simulation_id
    returning public_clicks into current_clicks;
  else
    select public_clicks
    into current_clicks
    from simulations
    where id = p_simulation_id;
  end if;

  return coalesce(current_clicks, 0);
end;
$$;
