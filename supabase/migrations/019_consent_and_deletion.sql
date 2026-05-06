-- Consent + deletion tracking for the private beta.
--
-- We track three explicit consents at signup, plus a version pointer so we can
-- re-prompt if the terms materially change. Deletion requests are logged here
-- so we have an audit trail even before the request is actioned.

alter table operator_accounts
  add column if not exists consent_version text,
  add column if not exists consent_accepted_at timestamptz,
  add column if not exists consent_own_data boolean not null default false,
  add column if not exists consent_anonymized_processing boolean not null default false,
  add column if not exists consent_aggregated_licensing boolean not null default false,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_completed_at timestamptz;

create index if not exists operator_accounts_deletion_requested_idx
  on operator_accounts(deletion_requested_at)
  where deletion_requested_at is not null;
