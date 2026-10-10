insert into public.kill_teams (name, generic_faction, forty_k_faction, is_homebrew)
values ('Chaos Daemons', 'Chaos', 'Chaos Daemons', true)
on conflict (name) do update
set generic_faction = excluded.generic_faction,
    forty_k_faction = excluded.forty_k_faction,
    is_homebrew = excluded.is_homebrew;
