-- Atomic credit decrement: returns true if credit was used, false otherwise
create or replace function use_credit(api_key text)
returns boolean
language plpgsql
security definer
as $$
declare
  rows_affected int;
begin
  update api_keys
  set credits = credits - 1
  where key = api_key and credits > 0;

  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$;
