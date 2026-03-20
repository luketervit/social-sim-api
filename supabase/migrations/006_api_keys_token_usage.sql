alter table api_keys
  add column if not exists total_tokens_used integer not null default 0;

create or replace function increment_api_key_tokens_used(api_key text, token_amount integer default 0)
returns boolean
language plpgsql
security definer
as $$
declare
  rows_affected int;
begin
  update api_keys
  set total_tokens_used = total_tokens_used + greatest(token_amount, 0)
  where key = api_key;

  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$;
