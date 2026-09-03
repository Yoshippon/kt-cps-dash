-- Consolidate duplicate team catalogs without losing match, ownership, or gallery data.

alter table public.kill_teams
  add column if not exists generic_faction text null,
  add column if not exists forty_k_faction text null,
  add column if not exists season integer null,
  add column if not exists box_number text null,
  add column if not exists box_name text null,
  add column if not exists category text null,
  add column if not exists operatives integer null,
  add column if not exists wounds integer null,
  add column if not exists apl integer null,
  add column if not exists release_date date null,
  add column if not exists min_operatives integer null,
  add column if not exists max_operatives integer null,
  add column if not exists min_wounds integer null,
  add column if not exists max_wounds integer null,
  add column if not exists min_apl integer null,
  add column if not exists max_apl integer null,
  add column if not exists min_activations integer null,
  add column if not exists max_activations integer null,
  add column if not exists kill_op integer null,
  add column if not exists trooper_apl integer null;

alter table public.player_team_images
  drop constraint if exists player_team_images_player_id_team_id_fkey;

alter table public.player_team_ownership
  drop constraint if exists player_team_ownership_team_id_fkey;

alter table public.matches
  drop constraint if exists matches_team_one_id_fkey,
  drop constraint if exists matches_team_two_id_fkey;

-- Older projects have a separate `teams` catalog to merge. Fresh projects
-- already use `kill_teams`, so no legacy rows need migration.
do $$
begin
  if to_regclass('public.teams') is not null then
    insert into public.kill_teams (name, description)
    select name, description
    from public.teams
    on conflict (name) do update
    set description = coalesce(public.kill_teams.description, excluded.description);

    update public.player_team_ownership ownership
    set team_id = kill_team.id
    from public.teams team
    join public.kill_teams kill_team on kill_team.name = team.name
    where ownership.team_id = team.id;

    update public.matches match
    set team_one_id = kill_team.id
    from public.teams team
    join public.kill_teams kill_team on kill_team.name = team.name
    where match.team_one_id = team.id;

    update public.matches match
    set team_two_id = kill_team.id
    from public.teams team
    join public.kill_teams kill_team on kill_team.name = team.name
    where match.team_two_id = team.id;

    drop table public.teams;
  end if;
end
$$;

alter table public.player_team_ownership
  add constraint player_team_ownership_team_id_fkey
  foreign key (team_id) references public.kill_teams(id) on delete cascade;

alter table public.player_team_images
  add constraint player_team_images_player_id_team_id_fkey
  foreign key (player_id, team_id)
  references public.player_team_ownership(player_id, team_id)
  on delete cascade;

alter table public.matches
  add constraint matches_team_one_id_fkey
  foreign key (team_one_id) references public.kill_teams(id) on delete set null,
  add constraint matches_team_two_id_fkey
  foreign key (team_two_id) references public.kill_teams(id) on delete set null;
