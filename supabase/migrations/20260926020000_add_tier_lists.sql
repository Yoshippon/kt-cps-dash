create table public.tier_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.players(id) on delete cascade,
  name text not null,
  includes_non_classified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.tier_list_entries (
  tier_list_id uuid not null references public.tier_lists(id) on delete cascade,
  team_id uuid not null references public.kill_teams(id) on delete cascade,
  tier text not null check (tier in ('S', 'A', 'B', 'C', 'D')),
  position integer not null check (position >= 0),
  primary key (tier_list_id, team_id)
);

create index tier_lists_owner_created_idx
  on public.tier_lists (owner_id, created_at desc);

create index tier_list_entries_order_idx
  on public.tier_list_entries (tier_list_id, tier, position);

alter table public.tier_lists enable row level security;
alter table public.tier_list_entries enable row level security;

create policy "Read all tier lists" on public.tier_lists for select using (true);
create policy "Owners manage tier lists" on public.tier_lists
  for all using (owner_id = public.current_player_id() or public.is_admin())
  with check (owner_id = public.current_player_id() or public.is_admin());

create policy "Read all tier list entries" on public.tier_list_entries for select using (true);

create trigger set_tier_lists_updated_at
before update on public.tier_lists
for each row
execute function public.set_updated_at();

create or replace function public.prevent_tier_list_roster_change()
returns trigger
language plpgsql
as $$
begin
  if new.includes_non_classified is distinct from old.includes_non_classified then
    raise exception 'tier list roster selection cannot be changed after creation';
  end if;

  return new;
end;
$$;

create trigger prevent_tier_list_roster_change
before update on public.tier_lists
for each row
execute function public.prevent_tier_list_roster_change();

create or replace function public.create_tier_list(
  p_name text,
  p_includes_non_classified boolean
)
returns public.tier_lists
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_player_name text;
  v_base_name text;
  v_name text;
  v_suffix integer := 2;
  v_tier_list public.tier_lists;
begin
  v_owner_id := public.current_player_id();
  if v_owner_id is null then
    raise exception 'must claim a player before creating a tier list';
  end if;

  select name into v_player_name
  from public.players
  where id = v_owner_id;

  v_base_name := coalesce(nullif(btrim(p_name), ''), v_player_name || ' - ' || to_char(current_date, 'YYYY-MM-DD'));
  v_name := v_base_name;

  while exists (
    select 1
    from public.tier_lists
    where owner_id = v_owner_id and name = v_name
  ) loop
    v_name := v_base_name || ' (' || v_suffix || ')';
    v_suffix := v_suffix + 1;
  end loop;

  insert into public.tier_lists (owner_id, name, includes_non_classified)
  values (v_owner_id, v_name, p_includes_non_classified)
  returning * into v_tier_list;

  return v_tier_list;
end;
$$;

create or replace function public.replace_tier_list_entries(
  p_tier_list_id uuid,
  p_entries jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_includes_non_classified boolean;
begin
  select includes_non_classified
  into v_includes_non_classified
  from public.tier_lists
  where id = p_tier_list_id
    and (owner_id = public.current_player_id() or public.is_admin());

  if v_includes_non_classified is null then
    raise exception 'tier list not found or not editable';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_entries) as entry(team_id uuid, tier text, position integer)
    left join public.kill_teams team on team.id = entry.team_id
    where team.id is null
      or entry.tier not in ('S', 'A', 'B', 'C', 'D')
      or entry.position < 0
      or (not v_includes_non_classified and not team.is_classified)
  ) then
    raise exception 'tier list contains an invalid team or placement';
  end if;

  delete from public.tier_list_entries where tier_list_id = p_tier_list_id;

  insert into public.tier_list_entries (tier_list_id, team_id, tier, position)
  select p_tier_list_id, entry.team_id, entry.tier, entry.position
  from jsonb_to_recordset(p_entries) as entry(team_id uuid, tier text, position integer);
end;
$$;

grant execute on function public.create_tier_list(text, boolean) to authenticated;
grant execute on function public.replace_tier_list_entries(uuid, jsonb) to authenticated;
