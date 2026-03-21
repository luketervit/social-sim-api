alter table simulations
  add column if not exists persona_cap integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'simulations_persona_cap_check'
  ) then
    alter table simulations
      add constraint simulations_persona_cap_check
      check (persona_cap is null or persona_cap > 0);
  end if;
end $$;
