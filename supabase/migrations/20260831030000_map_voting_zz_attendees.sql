-- Return named confirmed attendees with map-vote totals.
-- Run after 20260831020000_map_voting_voters.sql.

drop function if exists public.get_map_vote_summary(uuid);

create function public.get_map_vote_summary(p_meeting_id uuid)
returns table (
  map_id uuid,
  map_name text,
  total_votes bigint,
  registered_votes bigint,
  anonymous_votes bigint,
  voter_names text[],
  attendee_player_names text[],
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
    where meeting_id = p_meeting_id
  ),
  limits as (
    select count, greatest(2, count / 2) as vote_limit, count / 2 as map_count
    from attendance
  ),
  attendee_names as (
    select coalesce(array_agg(players.name order by players.name), '{}'::text[]) as names
    from public.meeting_attendees
    join public.players on players.id = meeting_attendees.player_id
    where meeting_attendees.meeting_id = p_meeting_id
  )
  select
    maps.id,
    maps.name,
    count(map_votes.map_id) filter (where map_votes.rank <= limits.vote_limit),
    count(map_votes.map_id) filter (where map_votes.rank <= limits.vote_limit and map_votes.voter_kind = 'registered'),
    count(map_votes.map_id) filter (where map_votes.rank <= limits.vote_limit and map_votes.voter_kind = 'anonymous'),
    coalesce(
      array_agg(coalesce(players.name, 'Guest') order by map_votes.created_at)
        filter (where map_votes.rank <= limits.vote_limit),
      '{}'::text[]
    ),
    attendee_names.names,
    limits.count,
    limits.vote_limit,
    limits.map_count
  from public.maps as maps
  cross join limits
  cross join attendee_names
  left join public.map_votes
    on map_votes.meeting_id = p_meeting_id
    and map_votes.map_id = maps.id
  left join public.players
    on players.id = map_votes.player_id
  group by maps.id, maps.name, attendee_names.names, limits.count, limits.vote_limit, limits.map_count
  order by maps.name;
$$;

grant execute on function public.get_map_vote_summary(uuid) to authenticated;
