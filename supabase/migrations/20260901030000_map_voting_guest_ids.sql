-- Guest voting uses browser-stored UUIDs. Supabase anonymous auth is not required.

alter table public.meeting_attendees
  drop constraint if exists meeting_attendees_voter_id_fkey;

alter table public.map_votes
  drop constraint if exists map_votes_voter_id_fkey;

drop function if exists public.set_meeting_attendance(uuid, boolean);
drop function if exists public.replace_map_votes(uuid, uuid[]);

create function public.set_meeting_attendance(
  p_meeting_id uuid,
  p_voter_id uuid,
  p_attending boolean
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

  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    v_kind := 'anonymous';
    v_player_id := null;
  else
    v_kind := 'registered';
    v_player_id := public.current_player_id();
  end if;

  if p_attending then
    insert into public.meeting_attendees (meeting_id, voter_id, voter_kind, player_id)
    values (p_meeting_id, p_voter_id, v_kind, v_player_id)
    on conflict (meeting_id, voter_id) do nothing;
  else
    delete from public.meeting_attendees where meeting_id = p_meeting_id and voter_id = p_voter_id;
    delete from public.map_votes where meeting_id = p_meeting_id and voter_id = p_voter_id;
  end if;
end;
$$;

create function public.replace_map_votes(
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
  v_vote_limit integer;
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
    select 1 from public.meeting_attendees
    where meeting_id = p_meeting_id and voter_id = p_voter_id
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

create function public.get_my_map_vote_state(p_meeting_id uuid, p_voter_id uuid)
returns table (attendee boolean, selected_map_ids uuid[])
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.meeting_attendees
      where meeting_id = p_meeting_id and voter_id = p_voter_id
    ),
    coalesce(
      array(
        select map_id
        from public.map_votes
        where meeting_id = p_meeting_id and voter_id = p_voter_id
        order by rank
      ),
      '{}'::uuid[]
    );
$$;

grant execute on function public.ensure_next_meeting() to anon, authenticated;
grant execute on function public.get_map_vote_summary(uuid) to anon, authenticated;
grant execute on function public.get_my_map_vote_state(uuid, uuid) to anon, authenticated;
grant execute on function public.set_meeting_attendance(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.replace_map_votes(uuid, uuid, uuid[]) to anon, authenticated;
