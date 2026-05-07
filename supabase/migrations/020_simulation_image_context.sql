alter table simulations
  add column if not exists image_url text,
  add column if not exists image_analysis jsonb;
