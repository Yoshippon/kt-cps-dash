create table public.kill_team_tac_op_archetypes (
  team_id uuid not null references public.kill_teams(id) on delete cascade,
  tac_op_archetype_id uuid not null references public.tac_op_archetypes(id) on delete cascade,
  primary key (team_id, tac_op_archetype_id)
);

create index kill_team_tac_op_archetypes_archetype_idx
  on public.kill_team_tac_op_archetypes (tac_op_archetype_id);

alter table public.kill_team_tac_op_archetypes enable row level security;

create policy "Read all kill team tac op archetypes" on public.kill_team_tac_op_archetypes
  for select using (true);

create policy "Admins manage kill team tac op archetypes" on public.kill_team_tac_op_archetypes
  for all using (public.is_admin()) with check (public.is_admin());

do $$
declare
  missing_mappings text[];
begin
  with mappings (team_name, archetype_name) as (
    values
      ('Angels of Death', 'Security'), ('Angels of Death', 'Seek And Destroy'),
      ('Battleclade', 'Infiltration'), ('Battleclade', 'Recon'),
      ('Celestial Insidiants', 'Security'), ('Celestial Insidiants', 'Seek And Destroy'),
      ('Death Korps', 'Security'), ('Death Korps', 'Seek And Destroy'),
      ('Deathwatch', 'Seek And Destroy'), ('Deathwatch', 'Security'),
      ('Elucidian Starstriders', 'Recon'), ('Elucidian Starstriders', 'Security'),
      ('Exaction Squad', 'Security'), ('Exaction Squad', 'Seek And Destroy'),
      ('Hunter Clade', 'Recon'), ('Hunter Clade', 'Seek And Destroy'),
      ('Imperial Navy Breachers', 'Security'), ('Imperial Navy Breachers', 'Seek And Destroy'),
      ('Inquisitorial Agents', 'Recon'), ('Inquisitorial Agents', 'Security'),
      ('Inquisitorial Agents', 'Seek And Destroy'), ('Inquisitorial Agents', 'Infiltration'),
      ('Kasrkin', 'Security'), ('Kasrkin', 'Seek And Destroy'),
      ('Novitiates', 'Recon'), ('Novitiates', 'Security'),
      ('Phobos Strike Team', 'Infiltration'), ('Phobos Strike Team', 'Recon'),
      ('Ratlings', 'Security'), ('Ratlings', 'Infiltration'),
      ('Sanctifiers', 'Security'), ('Sanctifiers', 'Seek And Destroy'),
      ('Scout Squad', 'Infiltration'), ('Scout Squad', 'Recon'),
      ('Spectres', 'Infiltration'), ('Spectres', 'Recon'),
      ('Strike Force Variel', 'Seek And Destroy'), ('Strike Force Variel', 'Infiltration'),
      ('Tempestus Aquilons', 'Recon'), ('Tempestus Aquilons', 'Seek And Destroy'),
      ('Wolf Scouts', 'Seek And Destroy'), ('Wolf Scouts', 'Recon'),
      ('Blooded', 'Infiltration'), ('Blooded', 'Seek And Destroy'),
      ('Chaos Cult', 'Infiltration'), ('Chaos Cult', 'Seek And Destroy'),
      ('Fellgor Ravagers', 'Recon'), ('Fellgor Ravagers', 'Seek And Destroy'),
      ('Gellerpox Infected', 'Security'), ('Gellerpox Infected', 'Seek And Destroy'),
      ('Goremongers', 'Recon'), ('Goremongers', 'Seek And Destroy'),
      ('Legionaries', 'Security'), ('Legionaries', 'Seek And Destroy'),
      ('Murderwing', 'Recon'), ('Murderwing', 'Seek And Destroy'),
      ('Nemesis Claw', 'Infiltration'), ('Nemesis Claw', 'Seek And Destroy'),
      ('Plague Marines', 'Security'), ('Plague Marines', 'Seek And Destroy'),
      ('Warpcoven', 'Recon'), ('Warpcoven', 'Security'),
      ('Blades of Khaine', 'Seek And Destroy'), ('Blades of Khaine', 'Security'),
      ('Blades of Khaine', 'Recon'), ('Blades of Khaine', 'Infiltration'),
      ('Corsair Voidscarred', 'Infiltration'), ('Corsair Voidscarred', 'Recon'),
      ('Exodites', 'Recon'), ('Exodites', 'Seek And Destroy'),
      ('Hand of the Archon', 'Recon'), ('Hand of the Archon', 'Seek And Destroy'),
      ('Mandrakes', 'Infiltration'), ('Mandrakes', 'Recon'),
      ('Void-dancer Troupe', 'Infiltration'), ('Void-dancer Troupe', 'Recon'),
      ('Canoptek Circle', 'Recon'), ('Canoptek Circle', 'Security'),
      ('Hierotek Circle', 'Recon'), ('Hierotek Circle', 'Security'),
      ('Kommandos', 'Seek And Destroy'), ('Kommandos', 'Infiltration'),
      ('Wrecka Crew', 'Seek And Destroy'), ('Wrecka Crew', 'Security'),
      ('Farstalker Kinband', 'Infiltration'), ('Farstalker Kinband', 'Recon'),
      ('Pathfinders', 'Infiltration'), ('Pathfinders', 'Recon'),
      ('Vespid Stingwings', 'Recon'), ('Vespid Stingwings', 'Seek And Destroy'),
      ('XV26 Stealth Battlesuits', 'Infiltration'), ('XV26 Stealth Battlesuits', 'Recon'),
      ('Brood Brothers', 'Infiltration'), ('Brood Brothers', 'Security'),
      ('Raveners', 'Seek And Destroy'), ('Raveners', 'Infiltration'),
      ('Wyrmblade', 'Seek And Destroy'), ('Wyrmblade', 'Infiltration'),
      ('Hearthkyn Salvagers', 'Recon'), ('Hearthkyn Salvagers', 'Security'),
      ('Hernkyn Yaegirs', 'Infiltration'), ('Hernkyn Yaegirs', 'Seek And Destroy')
  )
  select array_agg(format('%s / %s', mappings.team_name, mappings.archetype_name))
  into missing_mappings
  from mappings
  left join public.kill_teams on kill_teams.name = mappings.team_name
  left join public.tac_op_archetypes on tac_op_archetypes.name = mappings.archetype_name
  where kill_teams.id is null or tac_op_archetypes.id is null;

  if missing_mappings is not null then
    raise exception 'Could not resolve kill team tactical-operation archetype mappings: %', array_to_string(missing_mappings, ', ');
  end if;

  insert into public.kill_team_tac_op_archetypes (team_id, tac_op_archetype_id)
  select kill_teams.id, tac_op_archetypes.id
  from (values
    ('Angels of Death', 'Security'), ('Angels of Death', 'Seek And Destroy'),
    ('Battleclade', 'Infiltration'), ('Battleclade', 'Recon'),
    ('Celestial Insidiants', 'Security'), ('Celestial Insidiants', 'Seek And Destroy'),
    ('Death Korps', 'Security'), ('Death Korps', 'Seek And Destroy'),
    ('Deathwatch', 'Seek And Destroy'), ('Deathwatch', 'Security'),
    ('Elucidian Starstriders', 'Recon'), ('Elucidian Starstriders', 'Security'),
    ('Exaction Squad', 'Security'), ('Exaction Squad', 'Seek And Destroy'),
    ('Hunter Clade', 'Recon'), ('Hunter Clade', 'Seek And Destroy'),
    ('Imperial Navy Breachers', 'Security'), ('Imperial Navy Breachers', 'Seek And Destroy'),
    ('Inquisitorial Agents', 'Recon'), ('Inquisitorial Agents', 'Security'),
    ('Inquisitorial Agents', 'Seek And Destroy'), ('Inquisitorial Agents', 'Infiltration'),
    ('Kasrkin', 'Security'), ('Kasrkin', 'Seek And Destroy'),
    ('Novitiates', 'Recon'), ('Novitiates', 'Security'),
    ('Phobos Strike Team', 'Infiltration'), ('Phobos Strike Team', 'Recon'),
    ('Ratlings', 'Security'), ('Ratlings', 'Infiltration'),
    ('Sanctifiers', 'Security'), ('Sanctifiers', 'Seek And Destroy'),
    ('Scout Squad', 'Infiltration'), ('Scout Squad', 'Recon'),
    ('Spectres', 'Infiltration'), ('Spectres', 'Recon'),
    ('Strike Force Variel', 'Seek And Destroy'), ('Strike Force Variel', 'Infiltration'),
    ('Tempestus Aquilons', 'Recon'), ('Tempestus Aquilons', 'Seek And Destroy'),
    ('Wolf Scouts', 'Seek And Destroy'), ('Wolf Scouts', 'Recon'),
    ('Blooded', 'Infiltration'), ('Blooded', 'Seek And Destroy'),
    ('Chaos Cult', 'Infiltration'), ('Chaos Cult', 'Seek And Destroy'),
    ('Fellgor Ravagers', 'Recon'), ('Fellgor Ravagers', 'Seek And Destroy'),
    ('Gellerpox Infected', 'Security'), ('Gellerpox Infected', 'Seek And Destroy'),
    ('Goremongers', 'Recon'), ('Goremongers', 'Seek And Destroy'),
    ('Legionaries', 'Security'), ('Legionaries', 'Seek And Destroy'),
    ('Murderwing', 'Recon'), ('Murderwing', 'Seek And Destroy'),
    ('Nemesis Claw', 'Infiltration'), ('Nemesis Claw', 'Seek And Destroy'),
    ('Plague Marines', 'Security'), ('Plague Marines', 'Seek And Destroy'),
    ('Warpcoven', 'Recon'), ('Warpcoven', 'Security'),
    ('Blades of Khaine', 'Seek And Destroy'), ('Blades of Khaine', 'Security'),
    ('Blades of Khaine', 'Recon'), ('Blades of Khaine', 'Infiltration'),
    ('Corsair Voidscarred', 'Infiltration'), ('Corsair Voidscarred', 'Recon'),
    ('Exodites', 'Recon'), ('Exodites', 'Seek And Destroy'),
    ('Hand of the Archon', 'Recon'), ('Hand of the Archon', 'Seek And Destroy'),
    ('Mandrakes', 'Infiltration'), ('Mandrakes', 'Recon'),
    ('Void-dancer Troupe', 'Infiltration'), ('Void-dancer Troupe', 'Recon'),
    ('Canoptek Circle', 'Recon'), ('Canoptek Circle', 'Security'),
    ('Hierotek Circle', 'Recon'), ('Hierotek Circle', 'Security'),
    ('Kommandos', 'Seek And Destroy'), ('Kommandos', 'Infiltration'),
    ('Wrecka Crew', 'Seek And Destroy'), ('Wrecka Crew', 'Security'),
    ('Farstalker Kinband', 'Infiltration'), ('Farstalker Kinband', 'Recon'),
    ('Pathfinders', 'Infiltration'), ('Pathfinders', 'Recon'),
    ('Vespid Stingwings', 'Recon'), ('Vespid Stingwings', 'Seek And Destroy'),
    ('XV26 Stealth Battlesuits', 'Infiltration'), ('XV26 Stealth Battlesuits', 'Recon'),
    ('Brood Brothers', 'Infiltration'), ('Brood Brothers', 'Security'),
    ('Raveners', 'Seek And Destroy'), ('Raveners', 'Infiltration'),
    ('Wyrmblade', 'Seek And Destroy'), ('Wyrmblade', 'Infiltration'),
    ('Hearthkyn Salvagers', 'Recon'), ('Hearthkyn Salvagers', 'Security'),
    ('Hernkyn Yaegirs', 'Infiltration'), ('Hernkyn Yaegirs', 'Seek And Destroy')
  ) as mappings(team_name, archetype_name)
  join public.kill_teams on kill_teams.name = mappings.team_name
  join public.tac_op_archetypes on tac_op_archetypes.name = mappings.archetype_name
  on conflict do nothing;
end;
$$;
