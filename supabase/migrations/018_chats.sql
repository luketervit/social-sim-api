-- Persisted chats for the dashboard workspace. Chats are owned by a user,
-- can reference an audience (set null on delete so the chat survives if the
-- user removes its audience), and store the run state inline so reloading
-- the dashboard restores the conversation.

create table if not exists public.chats (
  id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  audience_id text references public.audiences(id) on delete set null,
  audience_name text,
  audience_row_count integer,
  platform text,
  post text not null default '',
  persona_cap integer not null default 25,
  mode text,
  variants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_owner_idx on public.chats (owner_user_id);
create index if not exists chats_owner_updated_idx
  on public.chats (owner_user_id, updated_at desc);

alter table public.chats enable row level security;

drop policy if exists "chats are owner readable" on public.chats;
create policy "chats are owner readable"
  on public.chats for select
  using (auth.uid() = owner_user_id);

drop policy if exists "chats are owner writable" on public.chats;
create policy "chats are owner writable"
  on public.chats for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);
