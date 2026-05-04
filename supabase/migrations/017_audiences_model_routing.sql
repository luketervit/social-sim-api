-- Persist Claude's routing decision per audience so the simulation runtime
-- can use the chosen generator + so the UI can show which models were
-- selected and why.

alter table audiences
  add column if not exists routing_decision jsonb,
  add column if not exists generator_model text,
  add column if not exists classifier_models jsonb;

create index if not exists audiences_generator_model_idx
  on audiences(generator_model)
  where generator_model is not null;
