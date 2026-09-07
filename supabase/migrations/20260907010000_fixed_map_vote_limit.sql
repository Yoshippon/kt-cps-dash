-- Every attendee receives five map choices, regardless of attendance count.

create or replace function public.replace_map_votes(
  p_meeting_id uuid,
  p_voter_id uuid,
  p_map_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting public.meetings;
  v_kind public.vote_voter_kind;
  v_player_id uuid;
begin
  if p_voter_id is null then
    raise exception 'voter identity is required';
  end if;

  select * into v_meeting from public.meetings where id = p_meeting_id;
  if v_meeting.id is null or now() < v_meeting.opens_at or now() >= v_meeting.closes_at then
    raise exception 'map voting is closed';
  end if;

  if auth.uid() is not null and auth.uid() <> p_voter_id then
    raise exception 'voter identity does not match signed-in user';
  end if;

  if not exists (
    select 1
    from public.meeting_attendees
    where meeting_id = p_meeting_id and voter_id = p_voter_id and is_attending
  ) then
    raise exception 'confirm attendance before voting';
  end if;

  if coalesce(cardinality(p_map_ids), 0) > 5 then
    raise exception 'you may choose at most 5 maps';
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

  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    v_kind := 'anonymous';
    v_player_id := null;
  else
    v_kind := 'registered';
    v_player_id := public.current_player_id();
  end if;

  delete from public.map_votes where meeting_id = p_meeting_id and voter_id = p_voter_id;

  insert into public.map_votes (meeting_id, voter_id, map_id, rank, voter_kind, player_id)
  select p_meeting_id, p_voter_id, map_id, ordinality, v_kind, v_player_id
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
  voter_names text[],
  attendee_player_names text[],
  unavailable_player_names text[],
  unavailable_player_ids uuid[],
  attendance_count integer,
  vote_limit integer,
  map_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with attendance as (
    select count(*)::integer as count
    from public.meeting_attendees
    where meeting_id = p_meeting_id and is_attending
  ),
  attendee_names as (
    select
      coalesce(array_agg(players.name order by players.name) filter (where meeting_attendees.is_attending), '{}'::text[]) as attending,
      coalesce(array_agg(players.name order by players.name) filter (where not meeting_attendees.is_attending), '{}'::text[]) as unavailable,
      coalesce(array_agg(players.id order by players.id) filter (where not meeting_attendees.is_attending), '{}'::uuid[]) as unavailable_ids
    from public.meeting_attendees
    join public.players on players.id = meeting_attendees.player_id
    where meeting_attendees.meeting_id = p_meeting_id
  )
  select
    maps.id,
    maps.name,
    count(map_votes.map_id) filter (where map_votes.rank <= 5),
    count(map_votes.map_id) filter (where map_votes.rank <= 5 and map_votes.voter_kind = 'registered'),
    count(map_votes.map_id) filter (where map_votes.rank <= 5 and map_votes.voter_kind = 'anonymous'),
    coalesce(
      array_agg(coalesce(players.name, 'Guest') order by map_votes.created_at)
        filter (where map_votes.rank <= 5),
      '{}'::text[]
    ),
    attendee_names.attending,
    attendee_names.unavailable,
    attendee_names.unavailable_ids,
    attendance.count,
    5,
    attendance.count / 2
  from public.maps as maps
  cross join attendance
  cross join attendee_names
  left join public.map_votes
    on map_votes.meeting_id = p_meeting_id
    and map_votes.map_id = maps.id
  left join public.players
    on players.id = map_votes.player_id
  group by maps.id, maps.name, attendee_names.attending, attendee_names.unavailable, attendee_names.unavailable_ids, attendance.count
  order by maps.name;
$$;

grant execute on function public.get_map_vote_summary(uuid) to anon, authenticated;
grant execute on function public.replace_map_votes(uuid, uuid, uuid[]) to anon, authenticated;
