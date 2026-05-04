-- User-owned audiences: lets signed-in operators upload their own customer
-- text data (CSV/JSON) and auto-derive a persona collection from it.
--
-- Existing seeded audiences keep `owner_user_id = null` and `source = 'seeded'`.

alter table audiences
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists source text default 'seeded',
  add column if not exists platform text default 'twitter',
  add column if not exists status text default 'ready',
  add column if not exists error_message text,
  add column if not exists row_count int,
  add column if not exists processed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audiences_status_check'
  ) then
    alter table audiences
      add constraint audiences_status_check
      check (status in ('processing', 'ready', 'failed'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audiences_source_check'
  ) then
    alter table audiences
      add constraint audiences_source_check
      check (source in ('seeded', 'uploaded'));
  end if;
end $$;

create index if not exists audiences_owner_idx
  on audiences(owner_user_id, created_at desc)
  where owner_user_id is not null;

-- Backfill existing rows: seeded audiences are public and ready.
update audiences
set source = 'seeded', status = 'ready'
where source is null or status is null;

-- RLS: anonymous still reads seeded audiences (existing audiences_read policy
-- remains). Owners can read/insert/update/delete their own uploaded audiences
-- via the service role — we don't expose direct DB access to clients here.
-- All API surfaces gate by user_id at the route handler level.
