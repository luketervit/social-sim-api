alter table simulations
  add column if not exists api_key text references api_keys(key),
  add column if not exists status text not null default 'queued',
  add column if not exists progress_messages int not null default 0,
  add column if not exists reserved_credits int not null default 0,
  add column if not exists refunded_credits int not null default 0,
  add column if not exists error_message text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists claimed_by text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'simulations_status_check'
  ) then
    alter table simulations
      add constraint simulations_status_check
      check (status in ('queued', 'running', 'completed', 'failed'));
  end if;
end $$;

create index if not exists simulations_status_lease_idx
  on simulations(status, lease_expires_at, created_at);

create index if not exists simulations_api_key_created_idx
  on simulations(api_key, created_at desc);

create or replace function public.set_simulations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists simulations_set_updated_at on simulations;
create trigger simulations_set_updated_at
  before update on simulations
  for each row execute procedure public.set_simulations_updated_at();

create or replace function public.claim_next_simulation_job(
  p_worker_id text,
  p_lease_seconds integer default 900
)
returns setof simulations
language plpgsql
security definer
as $$
declare
  claimed simulations%rowtype;
begin
  update simulations
  set status = 'running',
      started_at = coalesce(started_at, now()),
      claimed_by = p_worker_id,
      lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 30))
  where id = (
    select id
    from simulations
    where status = 'queued'
       or (status = 'running' and lease_expires_at is not null and lease_expires_at < now())
    order by created_at asc
    limit 1
    for update skip locked
  )
  returning * into claimed;

  if claimed.id is null then
    return;
  end if;

  return next claimed;
  return;
end;
$$;
