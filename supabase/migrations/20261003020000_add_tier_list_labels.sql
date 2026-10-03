alter table public.tier_lists
  add column tier_labels jsonb not null default '{"S": "S", "A": "A", "B": "B", "C": "C", "D": "D"}'::jsonb;

create or replace function public.save_tier_list(
  p_tier_list_id uuid,
  p_entries jsonb,
  p_tier_labels jsonb
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

  if jsonb_typeof(p_tier_labels) <> 'object'
    or not p_tier_labels ?& array['S', 'A', 'B', 'C', 'D']
    or (select count(*) from jsonb_object_keys(p_tier_labels)) <> 5
    or exists (
      select 1
      from jsonb_each(p_tier_labels) as label(tier, value)
      where jsonb_typeof(label.value) <> 'string'
        or btrim(label.value #>> '{}') = ''
        or char_length(btrim(label.value #>> '{}')) > 40
    ) then
    raise exception 'tier list contains invalid tier labels';
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

  update public.tier_lists
  set tier_labels = (
    select jsonb_object_agg(key, btrim(value #>> '{}'))
    from jsonb_each(p_tier_labels)
  )
  where id = p_tier_list_id;

  delete from public.tier_list_entries where tier_list_id = p_tier_list_id;

  insert into public.tier_list_entries (tier_list_id, team_id, tier, position)
  select p_tier_list_id, entry.team_id, entry.tier, entry.position
  from jsonb_to_recordset(p_entries) as entry(team_id uuid, tier text, position integer);
end;
$$;

grant execute on function public.save_tier_list(uuid, jsonb, jsonb) to authenticated;
