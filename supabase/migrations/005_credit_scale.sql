alter table api_keys
  alter column credits set default 7500;

update api_keys
set credits = credits * 75;

create or replace function use_credit(api_key text, credit_amount integer default 1)
returns boolean
language plpgsql
security definer
as $$
declare
  rows_affected int;
begin
  update api_keys
  set credits = credits - credit_amount
  where key = api_key and credits >= credit_amount;

  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$;
