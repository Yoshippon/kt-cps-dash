alter table public.kill_teams
  add column if not exists is_classified boolean not null default true;

update public.kill_teams
set is_classified = false
where season in (0, 1);
