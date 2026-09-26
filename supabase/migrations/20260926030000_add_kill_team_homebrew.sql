alter table public.kill_teams
  add column if not exists is_homebrew boolean not null default false;

update public.kill_teams
set is_homebrew = true
where name in ('Ogryns', 'Ecclesiarchy', 'Greenskins');

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
      or team.is_homebrew
  ) then
    raise exception 'tier list contains an invalid team or placement';
  end if;

  delete from public.tier_list_entries where tier_list_id = p_tier_list_id;

  insert into public.tier_list_entries (tier_list_id, team_id, tier, position)
  select p_tier_list_id, entry.team_id, entry.tier, entry.position
  from jsonb_to_recordset(p_entries) as entry(team_id uuid, tier text, position integer);
end;
$$;
