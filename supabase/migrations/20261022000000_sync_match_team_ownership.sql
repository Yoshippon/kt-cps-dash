create or replace function public.sync_match_team_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.player_one_id is not null and new.team_one_id is not null then
    insert into public.player_team_ownership (player_id, team_id)
    values (new.player_one_id, new.team_one_id)
    on conflict (player_id, team_id) do nothing;
  end if;

  if new.player_two_id is not null and new.team_two_id is not null then
    insert into public.player_team_ownership (player_id, team_id)
    values (new.player_two_id, new.team_two_id)
    on conflict (player_id, team_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_match_team_ownership on public.matches;

create trigger sync_match_team_ownership
after insert or update of player_one_id, player_two_id, team_one_id, team_two_id on public.matches
for each row
execute function public.sync_match_team_ownership();
