-- Staging table for audience uploads. Holds the parsed rows so the durable
-- workflow can resume across crashes / function timeouts without re-uploading.
-- Cleared on completion (or kept long enough for debugging on failure).

create table if not exists audience_staging (
  audience_id uuid primary key references audiences(id) on delete cascade,
  rows jsonb not null,
  headers jsonb not null default '[]'::jsonb,
  synthetic boolean not null default false,
  audience_name text not null,
  platform text not null,
  workflow_run_id text,
  created_at timestamptz not null default now()
);

create index if not exists audience_staging_run_idx
  on audience_staging(workflow_run_id)
  where workflow_run_id is not null;
