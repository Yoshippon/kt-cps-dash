create extension if not exists pgcrypto;

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  map text not null,
  team_one text not null,
  team_two text not null,
  player_one text not null,
  player_two text not null,
  is_tied boolean not null default false,
  is_homebrew boolean not null default false,
  is_player_one_skip boolean not null default false,
  is_player_two_skip boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maps (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matches_date_idx on public.matches (date desc);
create index if not exists matches_player_one_idx on public.matches (player_one);
create index if not exists matches_player_two_idx on public.matches (player_two);
create index if not exists maps_name_idx on public.maps (name);

alter table public.matches enable row level security;
alter table public.maps enable row level security;

create policy "Read matches" on public.matches
  for select using (true);

create policy "Write matches" on public.matches
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "Read maps" on public.maps
  for select using (true);

create policy "Write maps" on public.maps
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_matches_updated_at
before update on public.matches
for each row
execute function public.set_updated_at();

create trigger set_maps_updated_at
before update on public.maps
for each row
execute function public.set_updated_at();
