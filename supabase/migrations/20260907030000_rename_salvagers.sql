-- Replace the incorrect Salvagers catalog entry without losing its history.

do $$
declare
  v_old_id uuid;
  v_new_id uuid;
  v_old_logo_path text;
  v_new_logo_path text;
begin
  select id, logo_path into v_old_id, v_old_logo_path
  from public.kill_teams
  where name = 'Salvagers';

  if v_old_id is null then
    return;
  end if;

  select id, logo_path into v_new_id, v_new_logo_path
  from public.kill_teams
  where name = 'Hearthkyn Salvagers';

  if v_new_id is null then
    update public.kill_teams
    set name = 'Hearthkyn Salvagers'
    where id = v_old_id;
    return;
  end if;

  if v_new_logo_path is null and v_old_logo_path is not null then
    update public.kill_teams
    set logo_path = null
    where id = v_old_id;

    update public.kill_teams
    set logo_path = v_old_logo_path
    where id = v_new_id;
  end if;

  insert into public.player_team_ownership (player_id, team_id)
  select player_id, v_new_id
  from public.player_team_ownership
  where team_id = v_old_id
  on conflict do nothing;

  update public.player_team_images
  set team_id = v_new_id
  where team_id = v_old_id;

  update public.matches
  set team_one_id = v_new_id
  where team_one_id = v_old_id;

  update public.matches
  set team_two_id = v_new_id
  where team_two_id = v_old_id;

  delete from public.player_team_ownership
  where team_id = v_old_id;

  delete from public.kill_teams
  where id = v_old_id;
end
$$;
