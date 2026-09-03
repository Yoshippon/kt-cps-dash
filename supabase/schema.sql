create extension if not exists pgcrypto;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
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

create table if not exists public.tac_op_archetypes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tac_ops (
  id uuid primary key default gen_random_uuid(),
  number integer not null,
  name text not null unique,
  archetype_id uuid not null references public.tac_op_archetypes(id) on delete restrict,
  approved_ops_pack_id uuid not null references public.approved_ops_packs(id) on delete restrict,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tac_ops
  add column if not exists number integer null;

alter table public.tac_ops
  add column if not exists archetype_id uuid null references public.tac_op_archetypes(id) on delete restrict;

alter table public.tac_ops
  add column if not exists approved_ops_pack_id uuid null references public.approved_ops_packs(id) on delete restrict;

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
  generic_faction text null,
  forty_k_faction text null,
  season integer null,
  box_number text null,
  box_name text null,
  category text null,
  operatives integer null,
  wounds integer null,
  apl integer null,
  release_date date null,
  min_operatives integer null,
  max_operatives integer null,
  min_wounds integer null,
  max_wounds integer null,
  min_apl integer null,
  max_apl integer null,
  min_activations integer null,
  max_activations integer null,
  kill_op integer null,
  trooper_apl integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_team_ownership (
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.kill_teams(id) on delete cascade,
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
  team_one_id uuid null references public.kill_teams(id) on delete set null,
  team_two_id uuid null references public.kill_teams(id) on delete set null,
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
create index if not exists maps_name_idx on public.maps (name);
create index if not exists archetypes_category_idx on public.archetypes (category);
create index if not exists crit_ops_number_idx on public.crit_ops (number);
create unique index if not exists crit_ops_name_idx on public.crit_ops (name);
create index if not exists crit_ops_pack_idx on public.crit_ops (approved_ops_pack_id);
create index if not exists archetypes_pack_idx on public.archetypes (approved_ops_pack_id);
create index if not exists approved_ops_packs_year_idx on public.approved_ops_packs (year);
create unique index if not exists tac_ops_name_idx on public.tac_ops (name);
create index if not exists tac_ops_number_idx on public.tac_ops (number);
create index if not exists tac_ops_archetype_idx on public.tac_ops (archetype_id);
create index if not exists tac_ops_pack_idx on public.tac_ops (approved_ops_pack_id);
create index if not exists kill_teams_name_idx on public.kill_teams (name);
create index if not exists matches_date_idx on public.matches (date desc);
create index if not exists matches_team_one_idx on public.matches (team_one_id);
create index if not exists matches_team_two_idx on public.matches (team_two_id);
create index if not exists matches_player_one_idx on public.matches (player_one_id);
create index if not exists matches_player_two_idx on public.matches (player_two_id);
create index if not exists matches_crit_op_idx on public.matches (crit_op_id);

alter table public.players enable row level security;
alter table public.maps enable row level security;
alter table public.archetypes enable row level security;
alter table public.crit_ops enable row level security;
alter table public.approved_ops_packs enable row level security;
alter table public.tac_op_archetypes enable row level security;
alter table public.tac_ops enable row level security;
alter table public.kill_teams enable row level security;
alter table public.player_team_ownership enable row level security;
alter table public.player_map_ownership enable row level security;
alter table public.matches enable row level security;

create policy "Read all players" on public.players for select using (true);
create policy "Write all players" on public.players for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Read all maps" on public.maps for select using (true);
create policy "Write all maps" on public.maps for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Read all archetypes" on public.archetypes for select using (true);
create policy "Write all archetypes" on public.archetypes for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Read all crit ops" on public.crit_ops for select using (true);
create policy "Write all crit ops" on public.crit_ops for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Read all approved ops packs" on public.approved_ops_packs for select using (true);
create policy "Write all approved ops packs" on public.approved_ops_packs for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Read all tac op archetypes" on public.tac_op_archetypes for select using (true);
create policy "Write all tac op archetypes" on public.tac_op_archetypes for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Read all tac ops" on public.tac_ops for select using (true);
create policy "Write all tac ops" on public.tac_ops for all using (auth.uid() is not null) with check (auth.uid() is not null);

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

create trigger set_tac_op_archetypes_updated_at
before update on public.tac_op_archetypes
for each row
execute function public.set_updated_at();

create trigger set_tac_ops_updated_at
before update on public.tac_ops
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

-- === Auth: player claiming ===

alter table public.players
  add column if not exists user_id uuid null unique references auth.users(id) on delete set null;

alter table public.players
  add column if not exists is_admin boolean not null default false;

create index if not exists players_user_id_idx on public.players (user_id);

-- Claim tokens live in their own table so they are never exposed through the
-- public "read all players" select policy (players are selectable by anyone,
-- tokens are not).
create table if not exists public.player_claim_tokens (
  player_id uuid primary key references public.players(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.player_claim_tokens enable row level security;

-- helper functions (security definer so they can be used inside policies
-- without re-triggering RLS recursion, and owner bypasses RLS anyway)

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.players where user_id = auth.uid()), false);
$$;

create or replace function public.current_player_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.players where user_id = auth.uid();
$$;

-- admins only: list/manage tokens directly
create policy "Admins manage claim tokens" on public.player_claim_tokens
  for all using (public.is_admin()) with check (public.is_admin());

-- admin-only: (re)issue a claim token for a player, returns the token
create or replace function public.generate_claim_token(p_player_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if not public.is_admin() then
    raise exception 'only admins can generate claim tokens';
  end if;

  insert into public.player_claim_tokens (player_id, token, used_at)
  values (p_player_id, gen_random_uuid(), null)
  on conflict (player_id) do update
    set token = gen_random_uuid(), used_at = null
  returning token into v_token;

  return v_token;
end;
$$;

-- any signed-in user: claim an unclaimed player using a valid, unused token
create or replace function public.claim_player(p_token uuid)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_player public.players;
begin
  if auth.uid() is null then
    raise exception 'must be signed in to claim a player';
  end if;

  if exists (select 1 from public.players where user_id = auth.uid()) then
    raise exception 'this account has already claimed a player';
  end if;

  select player_id into v_player_id
  from public.player_claim_tokens
  where token = p_token and used_at is null;

  if v_player_id is null then
    raise exception 'invalid or already used claim link';
  end if;

  update public.players
  set user_id = auth.uid()
  where id = v_player_id and user_id is null
  returning * into v_player;

  if v_player.id is null then
    raise exception 'player already claimed';
  end if;

  update public.player_claim_tokens set used_at = now() where player_id = v_player_id;

  return v_player;
end;
$$;

grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.current_player_id() to authenticated, anon;
grant execute on function public.generate_claim_token(uuid) to authenticated;
grant execute on function public.claim_player(uuid) to authenticated;

-- tighten write policies: config/catalog tables become admin-only, matches
-- become "admin or one of the two players in the match"

drop policy if exists "Write all players" on public.players;
create policy "Admins manage players" on public.players
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Claimed players create opponents" on public.players
  for insert with check (public.current_player_id() is not null);

drop policy if exists "Write all maps" on public.maps;
create policy "Admins manage maps" on public.maps
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Write all archetypes" on public.archetypes;
create policy "Admins manage archetypes" on public.archetypes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Write all crit ops" on public.crit_ops;
create policy "Admins manage crit ops" on public.crit_ops
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Write all approved ops packs" on public.approved_ops_packs;
create policy "Admins manage approved ops packs" on public.approved_ops_packs
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Write all tac op archetypes" on public.tac_op_archetypes;
create policy "Admins manage tac op archetypes" on public.tac_op_archetypes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Write all tac ops" on public.tac_ops;
create policy "Admins manage tac ops" on public.tac_ops
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Write all kill teams" on public.kill_teams;
create policy "Admins manage kill teams" on public.kill_teams
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Write all player team ownership" on public.player_team_ownership;
create policy "Admins manage player team ownership" on public.player_team_ownership
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Write all player map ownership" on public.player_map_ownership;
create policy "Admins manage player map ownership" on public.player_map_ownership
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Write all matches" on public.matches;
create policy "Insert own or admin matches" on public.matches
  for insert with check (
    public.is_admin()
    or player_one_id = public.current_player_id()
    or player_two_id = public.current_player_id()
  );
create policy "Update own or admin matches" on public.matches
  for update using (
    public.is_admin()
    or player_one_id = public.current_player_id()
    or player_two_id = public.current_player_id()
  ) with check (
    public.is_admin()
    or player_one_id = public.current_player_id()
    or player_two_id = public.current_player_id()
  );
create policy "Delete own or admin matches" on public.matches
  for delete using (
    public.is_admin()
    or player_one_id = public.current_player_id()
    or player_two_id = public.current_player_id()
  );
