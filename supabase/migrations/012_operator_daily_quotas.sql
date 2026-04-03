create table if not exists operator_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  usage_date date not null,
  used_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, bucket, usage_date),
  constraint operator_daily_usage_used_count_check check (used_count >= 0)
);

create index if not exists operator_daily_usage_bucket_date_idx
  on operator_daily_usage(bucket, usage_date desc);

alter table operator_daily_usage enable row level security;

drop policy if exists "operator_daily_usage_select_own" on operator_daily_usage;

create policy "operator_daily_usage_select_own" on operator_daily_usage
  for select using (auth.uid() = user_id);

create or replace function public.set_operator_daily_usage_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists operator_daily_usage_set_updated_at on operator_daily_usage;
create trigger operator_daily_usage_set_updated_at
  before update on operator_daily_usage
  for each row execute procedure public.set_operator_daily_usage_updated_at();

create or replace function public.consume_operator_daily_quota(
  p_user_id uuid,
  p_bucket text,
  p_daily_limit integer,
  p_amount integer default 1
)
returns table (
  allowed boolean,
  used_count integer,
  remaining integer,
  usage_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage_date date := timezone('utc', now())::date;
  v_used_count integer;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if p_bucket is null or length(trim(p_bucket)) = 0 then
    raise exception 'p_bucket is required';
  end if;

  if p_daily_limit <= 0 then
    raise exception 'p_daily_limit must be positive';
  end if;

  if p_amount <= 0 then
    raise exception 'p_amount must be positive';
  end if;

  loop
    insert into public.operator_daily_usage (
      user_id,
      bucket,
      usage_date,
      used_count
    )
    values (
      p_user_id,
      p_bucket,
      v_usage_date,
      p_amount
    )
    on conflict (user_id, bucket, usage_date)
    do update
      set used_count = operator_daily_usage.used_count + excluded.used_count
    where operator_daily_usage.used_count + excluded.used_count <= p_daily_limit
    returning operator_daily_usage.used_count into v_used_count;

    if found then
      allowed := true;
      used_count := v_used_count;
      remaining := greatest(p_daily_limit - v_used_count, 0);
      usage_date := v_usage_date;
      return next;
      return;
    end if;

    select odu.used_count
      into v_used_count
      from public.operator_daily_usage as odu
     where odu.user_id = p_user_id
       and odu.bucket = p_bucket
       and odu.usage_date = v_usage_date;

    if found then
      allowed := false;
      used_count := v_used_count;
      remaining := greatest(p_daily_limit - v_used_count, 0);
      usage_date := v_usage_date;
      return next;
      return;
    end if;
  end loop;
end;
$$;

create or replace function public.adjust_operator_daily_quota(
  p_user_id uuid,
  p_bucket text,
  p_delta integer
)
returns table (
  used_count integer,
  usage_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage_date date := timezone('utc', now())::date;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if p_bucket is null or length(trim(p_bucket)) = 0 then
    raise exception 'p_bucket is required';
  end if;

  insert into public.operator_daily_usage (
    user_id,
    bucket,
    usage_date,
    used_count
  )
  values (
    p_user_id,
    p_bucket,
    v_usage_date,
    greatest(p_delta, 0)
  )
  on conflict (user_id, bucket, usage_date)
  do update
    set used_count = greatest(operator_daily_usage.used_count + p_delta, 0)
  returning operator_daily_usage.used_count, operator_daily_usage.usage_date;
end;
$$;

create or replace function public.get_operator_daily_quota(
  p_user_id uuid,
  p_bucket text,
  p_daily_limit integer
)
returns table (
  used_count integer,
  remaining integer,
  usage_date date
)
language sql
security definer
set search_path = public
as $$
  with current_day as (
    select timezone('utc', now())::date as usage_date
  )
  select
    coalesce(odu.used_count, 0) as used_count,
    greatest(p_daily_limit - coalesce(odu.used_count, 0), 0) as remaining,
    current_day.usage_date
  from current_day
  left join public.operator_daily_usage as odu
    on odu.user_id = p_user_id
   and odu.bucket = p_bucket
   and odu.usage_date = current_day.usage_date;
$$;

create or replace function public.adjust_api_key_credits(
  p_api_key text,
  p_credit_delta integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
begin
  if p_api_key is null or length(trim(p_api_key)) = 0 then
    raise exception 'p_api_key is required';
  end if;

  update public.api_keys
     set credits = greatest(credits + p_credit_delta, 0)
   where key = p_api_key
   returning credits into v_credits;

  if v_credits is null then
    raise exception 'api key not found';
  end if;

  return v_credits;
end;
$$;
