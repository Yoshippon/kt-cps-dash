-- Weekly map voting. Run in Supabase SQL Editor after supabase/schema.sql.

do $$
begin
  create type public.vote_voter_kind as enum ('anonymous', 'registered');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  meeting_date date not null unique,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (opens_at < closes_at)
);

create table if not exists public.meeting_attendees (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  voter_kind public.vote_voter_kind not null,
  player_id uuid null references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (meeting_id, voter_id)
);

create table if not exists public.map_votes (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  map_id uuid not null references public.maps(id) on delete restrict,
  rank integer not null check (rank > 0),
  voter_kind public.vote_voter_kind not null,
  player_id uuid null references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (meeting_id, voter_id, map_id),
  unique (meeting_id, voter_id, rank)
);

create index if not exists meeting_attendees_meeting_idx on public.meeting_attendees (meeting_id);
create index if not exists map_votes_meeting_rank_idx on public.map_votes (meeting_id, rank);

alter table public.meetings enable row level security;
alter table public.meeting_attendees enable row level security;
alter table public.map_votes enable row level security;

create policy "Authenticated users read meetings" on public.meetings
  for select to authenticated using (true);

create policy "Users read own meeting attendance" on public.meeting_attendees
  for select to authenticated using (voter_id = auth.uid());

create policy "Users read own map votes" on public.map_votes
  for select to authenticated using (voter_id = auth.uid());

create or replace function public.ensure_next_meeting()
returns public.meetings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_next_meeting_date date;
  v_meeting public.meetings;
begin
  v_next_meeting_date := v_today + ((5 - extract(dow from v_today)::integer + 7) % 7);

  insert into public.meetings (meeting_date, opens_at, closes_at)
  values (
    v_next_meeting_date,
    ((v_next_meeting_date - 6)::timestamp at time zone 'America/Sao_Paulo'),
    (((v_next_meeting_date + 1)::timestamp + interval '9 hours') at time zone 'America/Sao_Paulo')
  )
  on conflict (meeting_date) do nothing;

  select * into v_meeting
  from public.meetings
  where opens_at <= now() and closes_at > now()
  order by meeting_date
  limit 1;

  if v_meeting.id is null then
    raise exception 'no active map-voting meeting exists';
  end if;

  return v_meeting;
end;
$$;

create or replace function public.set_meeting_attendance(p_meeting_id uuid, p_attending boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting public.meetings;
  v_kind public.vote_voter_kind;
begin
  if auth.uid() is null then
    raise exception 'sign in is required';
  end if;

  select * into v_meeting from public.meetings where id = p_meeting_id;
  if v_meeting.id is null or now() < v_meeting.opens_at or now() >= v_meeting.closes_at then
    raise exception 'map voting is closed';
  end if;

  v_kind := case when coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    then 'anonymous'::public.vote_voter_kind
    else 'registered'::public.vote_voter_kind
  end;

  if p_attending then
    insert into public.meeting_attendees (meeting_id, voter_id, voter_kind, player_id)
    values (p_meeting_id, auth.uid(), v_kind, public.current_player_id())
    on conflict (meeting_id, voter_id) do nothing;
  else
    delete from public.meeting_attendees where meeting_id = p_meeting_id and voter_id = auth.uid();
    delete from public.map_votes where meeting_id = p_meeting_id and voter_id = auth.uid();
  end if;
end;
$$;

create or replace function public.replace_map_votes(p_meeting_id uuid, p_map_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting public.meetings;
  v_vote_limit integer;
  v_kind public.vote_voter_kind;
begin
  if auth.uid() is null then
    raise exception 'sign in is required';
  end if;

  select * into v_meeting from public.meetings where id = p_meeting_id;
  if v_meeting.id is null or now() < v_meeting.opens_at or now() >= v_meeting.closes_at then
    raise exception 'map voting is closed';
  end if;

  if not exists (
    select 1 from public.meeting_attendees
    where meeting_id = p_meeting_id and voter_id = auth.uid()
  ) then
    raise exception 'confirm attendance before voting';
  end if;

  select greatest(2, count(*) / 2) into v_vote_limit
  from public.meeting_attendees
  where meeting_id = p_meeting_id;

  if coalesce(cardinality(p_map_ids), 0) > v_vote_limit then
    raise exception 'you may choose at most % maps', v_vote_limit;
  end if;

  if coalesce(cardinality(p_map_ids), 0) <> coalesce(cardinality(array(select distinct unnest(p_map_ids))), 0) then
    raise exception 'duplicate map choices are not allowed';
  end if;

  if exists (
    select 1
    from unnest(p_map_ids) as map_id
    left join public.maps on maps.id = map_id
    where maps.id is null
  ) then
    raise exception 'one or more maps do not exist';
  end if;

  v_kind := case when coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    then 'anonymous'::public.vote_voter_kind
    else 'registered'::public.vote_voter_kind
  end;

  delete from public.map_votes where meeting_id = p_meeting_id and voter_id = auth.uid();

  insert into public.map_votes (meeting_id, voter_id, map_id, rank, voter_kind, player_id)
  select p_meeting_id, auth.uid(), map_id, ordinality, v_kind, public.current_player_id()
  from unnest(p_map_ids) with ordinality as choices(map_id, ordinality);
end;
$$;

create or replace function public.get_map_vote_summary(p_meeting_id uuid)
returns table (
  map_id uuid,
  map_name text,
  total_votes bigint,
  registered_votes bigint,
  anonymous_votes bigint,
  attendance_count integer,
  vote_limit integer
)
language sql
stable
security definer
set search_path = public
as $$
  with attendance as (
    select count(*)::integer as count
    from public.meeting_attendees
    where meeting_id = p_meeting_id
  ),
  limits as (
    select count, greatest(2, count / 2) as value from attendance
  )
  select
    maps.id,
    maps.name,
    count(map_votes.map_id) filter (where map_votes.rank <= limits.value),
    count(map_votes.map_id) filter (where map_votes.rank <= limits.value and map_votes.voter_kind = 'registered'),
    count(map_votes.map_id) filter (where map_votes.rank <= limits.value and map_votes.voter_kind = 'anonymous'),
    limits.count,
    limits.value
  from public.maps as maps
  cross join limits
  left join public.map_votes
    on map_votes.meeting_id = p_meeting_id
    and map_votes.map_id = maps.id
  group by maps.id, maps.name, limits.count, limits.value
  order by maps.name;
$$;

grant execute on function public.ensure_next_meeting() to authenticated;
grant execute on function public.set_meeting_attendance(uuid, boolean) to authenticated;
grant execute on function public.replace_map_votes(uuid, uuid[]) to authenticated;
grant execute on function public.get_map_vote_summary(uuid) to authenticated;

-- Optional: after enabling pg_cron in Supabase, schedule this at Saturday
-- 00:00 America/Sao_Paulo (03:00 UTC). The app also creates it on first visit.
-- select cron.schedule('create-weekly-map-vote-meeting', '0 3 * * 6',
--   $$select public.ensure_next_meeting();$$);
