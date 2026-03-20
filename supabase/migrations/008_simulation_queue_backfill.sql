update simulations
set status = 'completed',
    progress_messages = coalesce(jsonb_array_length(thread), 0),
    started_at = coalesce(started_at, created_at),
    completed_at = coalesce(completed_at, created_at),
    claimed_by = null,
    lease_expires_at = null,
    error_message = null
where api_key is null
  and reserved_credits = 0
  and refunded_credits = 0;

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
    where api_key is not null
      and reserved_credits > 0
      and (
        status = 'queued'
        or (status = 'running' and lease_expires_at is not null and lease_expires_at < now())
      )
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
