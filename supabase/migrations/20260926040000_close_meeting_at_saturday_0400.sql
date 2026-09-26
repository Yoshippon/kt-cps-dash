-- Keep Friday's meeting active through Saturday 04:00 in Sao Paulo time.

update public.meetings
set closes_at = (((meeting_date + 1)::timestamp + interval '4 hours') at time zone 'America/Sao_Paulo');

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
    (((v_next_meeting_date + 1)::timestamp + interval '4 hours') at time zone 'America/Sao_Paulo')
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
