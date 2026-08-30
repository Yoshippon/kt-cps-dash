create extension if not exists pgcrypto;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text null,
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

create table if not exists public.archetypes (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null unique,
  approved_ops boolean not null default false,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crit_ops (
  id uuid primary key default gen_random_uuid(),
  number integer not null,
  name text not null,
  approved_ops boolean not null default false,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approved_ops_packs (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.archetypes
  add column if not exists approved_ops_pack_id uuid null references public.approved_ops_packs(id) on delete set null;

alter table public.archetypes
  drop column if exists approved_ops;

alter table public.crit_ops
  add column if not exists approved_ops_pack_id uuid null references public.approved_ops_packs(id) on delete set null;

alter table public.crit_ops
  drop column if exists approved_ops;

create table if not exists public.kill_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  archetype_id uuid null references public.archetypes(id) on delete set null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_team_ownership (
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  primary key (player_id, team_id)
);

create table if not exists public.player_map_ownership (
  player_id uuid not null references public.players(id) on delete cascade,
  map_id uuid not null references public.maps(id) on delete cascade,
  primary key (player_id, map_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  map_id uuid not null references public.maps(id) on delete restrict,
  team_one_id uuid null references public.teams(id) on delete set null,
  team_two_id uuid null references public.teams(id) on delete set null,
  player_one_id uuid null references public.players(id) on delete set null,
  player_two_id uuid null references public.players(id) on delete set null,
  crit_op_id uuid null references public.crit_ops(id) on delete set null,
  is_tied boolean not null default false,
  is_homebrew boolean not null default false,
  is_player_one_skip boolean not null default false,
  is_player_two_skip boolean not null default false,
  player_one_score integer null,
  player_two_score integer null,
  player_one_primary text null,
  player_two_primary text null,
  player_one_tac text null,
  player_two_tac text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.matches
  drop constraint if exists matches_unique_match;

alter table public.matches
  add column if not exists match_id text;

update public.matches
set match_id = coalesce(match_id, format('match-%s-%s-%s-%s', date, map_id::text, coalesce(player_one_id::text, 'null'), coalesce(player_two_id::text, 'null')))
where match_id is null;

alter table public.matches
  alter column match_id set not null;

create unique index if not exists matches_match_id_idx on public.matches (match_id);

create index if not exists players_name_idx on public.players (name);
create index if not exists teams_name_idx on public.teams (name);
create index if not exists maps_name_idx on public.maps (name);
create index if not exists archetypes_category_idx on public.archetypes (category);
create index if not exists crit_ops_number_idx on public.crit_ops (number);
create unique index if not exists crit_ops_name_idx on public.crit_ops (name);
create index if not exists crit_ops_pack_idx on public.crit_ops (approved_ops_pack_id);
create index if not exists archetypes_pack_idx on public.archetypes (approved_ops_pack_id);
create index if not exists approved_ops_packs_year_idx on public.approved_ops_packs (year);
create index if not exists kill_teams_name_idx on public.kill_teams (name);
create index if not exists matches_date_idx on public.matches (date desc);
create index if not exists matches_team_one_idx on public.matches (team_one_id);
create index if not exists matches_team_two_idx on public.matches (team_two_id);
create index if not exists matches_player_one_idx on public.matches (player_one_id);
create index if not exists matches_player_two_idx on public.matches (player_two_id);
create index if not exists matches_crit_op_idx on public.matches (crit_op_id);

alter table public.players enable row level security;
alter table public.teams enable row level security;
alter table public.maps enable row level security;
alter table public.archetypes enable row level security;
alter table public.crit_ops enable row level security;
alter table public.approved_ops_packs enable row level security;
alter table public.kill_teams enable row level security;
alter table public.player_team_ownership enable row level security;
alter table public.player_map_ownership enable row level security;
alter table public.matches enable row level security;

create policy "Read all players" on public.players for select using (true);
create policy "Write all players" on public.players for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Read all teams" on public.teams for select using (true);
create policy "Write all teams" on public.teams for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Read all maps" on public.maps for select using (true);
create policy "Write all maps" on public.maps for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Read all archetypes" on public.archetypes for select using (true);
create policy "Write all archetypes" on public.archetypes for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Read all crit ops" on public.crit_ops for select using (true);
create policy "Write all crit ops" on public.crit_ops for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Read all approved ops packs" on public.approved_ops_packs for select using (true);
create policy "Write all approved ops packs" on public.approved_ops_packs for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Read all kill teams" on public.kill_teams for select using (true);
create policy "Write all kill teams" on public.kill_teams for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Read all player team ownership" on public.player_team_ownership for select using (true);
create policy "Write all player team ownership" on public.player_team_ownership for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Read all player map ownership" on public.player_map_ownership for select using (true);
create policy "Write all player map ownership" on public.player_map_ownership for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Read all matches" on public.matches for select using (true);
create policy "Write all matches" on public.matches for all using (auth.uid() is not null) with check (auth.uid() is not null);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_players_updated_at
before update on public.players
for each row
execute function public.set_updated_at();

create trigger set_teams_updated_at
before update on public.teams
for each row
execute function public.set_updated_at();

create trigger set_maps_updated_at
before update on public.maps
for each row
execute function public.set_updated_at();

create trigger set_archetypes_updated_at
before update on public.archetypes
for each row
execute function public.set_updated_at();

create trigger set_crit_ops_updated_at
before update on public.crit_ops
for each row
execute function public.set_updated_at();

create trigger set_approved_ops_packs_updated_at
before update on public.approved_ops_packs
for each row
execute function public.set_updated_at();

create trigger set_kill_teams_updated_at
before update on public.kill_teams
for each row
execute function public.set_updated_at();

create trigger set_matches_updated_at
before update on public.matches
for each row
execute function public.set_updated_at();
