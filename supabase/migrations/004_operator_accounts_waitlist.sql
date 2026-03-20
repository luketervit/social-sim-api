create table if not exists operator_accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  waitlist boolean not null default true,
  waitlist_joined_at timestamptz not null default now(),
  access_granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists operator_accounts_email_idx
  on operator_accounts(email);

alter table operator_accounts enable row level security;

drop policy if exists "operator_accounts_select_own" on operator_accounts;

create policy "operator_accounts_select_own" on operator_accounts
  for select using (auth.uid() = id);

create or replace function public.handle_new_operator_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.operator_accounts (
    id,
    email,
    waitlist,
    waitlist_joined_at,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(new.email, ''),
    true,
    coalesce(new.created_at, now()),
    coalesce(new.created_at, now()),
    coalesce(new.created_at, now())
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

create or replace function public.sync_operator_account_state()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

  if new.waitlist then
    new.access_granted_at = null;
  elsif old.waitlist and new.access_granted_at is null then
    new.access_granted_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_operator_account on auth.users;
create trigger on_auth_user_created_operator_account
  after insert on auth.users
  for each row execute procedure public.handle_new_operator_account();

drop trigger if exists operator_accounts_state_sync on operator_accounts;
create trigger operator_accounts_state_sync
  before update on operator_accounts
  for each row execute procedure public.sync_operator_account_state();

insert into public.operator_accounts (
  id,
  email,
  waitlist,
  waitlist_joined_at,
  access_granted_at,
  created_at,
  updated_at
)
select
  id,
  coalesce(email, ''),
  false,
  coalesce(created_at, now()),
  coalesce(created_at, now()),
  coalesce(created_at, now()),
  now()
from auth.users
on conflict (id) do update
  set email = excluded.email;
