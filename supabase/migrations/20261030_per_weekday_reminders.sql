-- Give each weekday its own reminder time and pin all schedules to Vietnam time.
alter table public.n3vjit_study_reminders
  add column day_times time(0)[] not null default array['20:00'::time,'20:00'::time,'20:00'::time,'20:00'::time,'20:00'::time,'20:00'::time,'20:00'::time];

-- Preserve the previous shared time for every weekday, and retain the selected weekdays.
update public.n3vjit_study_reminders
set day_times = array_fill(local_time, array[7]), timezone = 'Asia/Ho_Chi_Minh';

create or replace function public.n3vjit_get_reminder() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ready', coalesce((select enabled from public.n3vjit_reminder_runtime where id), false),
    'push_ready', coalesce((select enabled and vapid_public_key is not null from public.n3vjit_push_runtime where id), false),
    'vapid_public_key', (select vapid_public_key from public.n3vjit_push_runtime where id),
    'settings', (select jsonb_build_object('enabled', r.enabled, 'push_enabled', r.push_enabled,
      'local_time', left(r.local_time::text, 5), 'timezone', 'Asia/Ho_Chi_Minh', 'weekdays', r.weekdays,
      'day_times', (select jsonb_agg(left(t::text, 5) order by n) from unnest(r.day_times) with ordinality as a(t,n)))
      from public.n3vjit_study_reminders r where r.user_id = auth.uid()),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'device_name', s.device_name,
      'created_at', s.created_at, 'last_success_at', s.last_success_at) order by s.created_at)
      from public.n3vjit_push_subscriptions s where s.user_id = auth.uid()), '[]'::jsonb)
  );
$$;

create or replace function public.n3vjit_save_reminder(p_enabled boolean,p_local_time text,p_timezone text,p_weekdays integer[],p_day_times text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_row public.n3vjit_study_reminders; parsed_times time(0)[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_enabled is null or p_local_time is null or p_local_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or p_weekdays is null or cardinality(p_weekdays) not between 1 and 7
    or exists(select 1 from unnest(p_weekdays) d where d is null or d<0 or d>6)
    or cardinality(p_weekdays)<>(select count(distinct d) from unnest(p_weekdays) d)
    or p_day_times is null or cardinality(p_day_times) <> 7
    or exists(select 1 from unnest(p_day_times) t where t is null or t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    then raise exception 'Invalid reminder settings'; end if;
  parsed_times := array(select t::time(0) from unnest(p_day_times) with ordinality as a(t,n) order by n);
  if p_enabled and (not coalesce((select enabled from public.n3vjit_reminder_runtime where id),false)
    or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and email is not null))
    then raise exception 'Email reminders are not ready'; end if;
  select * into current_row from public.n3vjit_study_reminders where user_id=auth.uid();
  insert into public.n3vjit_study_reminders(user_id,enabled,local_time,timezone,weekdays,day_times)
    values(auth.uid(),p_enabled,p_local_time::time,'Asia/Ho_Chi_Minh',p_weekdays,parsed_times)
    on conflict(user_id) do update set enabled=excluded.enabled,local_time=excluded.local_time,
      timezone='Asia/Ho_Chi_Minh',weekdays=excluded.weekdays,day_times=excluded.day_times,updated_at=clock_timestamp(),
      push_updated_at=case when (current_row.weekdays,current_row.day_times) is distinct from (excluded.weekdays,excluded.day_times)
        then clock_timestamp() else public.n3vjit_study_reminders.push_updated_at end;
  return public.n3vjit_get_reminder();
end;
$$;

create or replace function public.n3vjit_claim_reminder() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare candidate record; job public.n3vjit_reminder_deliveries; tick timestamptz:=clock_timestamp();
begin
  if not coalesce((select enabled from public.n3vjit_reminder_runtime where id),false) then return null; end if;
  for candidate in
    select r.*,u.email,dates.local_date,(dates.local_date+r.day_times[extract(dow from dates.local_date)::integer+1]) at time zone 'Asia/Ho_Chi_Minh' due_at
    from public.n3vjit_study_reminders r join auth.users u on u.id=r.user_id
    cross join lateral (values ((tick at time zone 'Asia/Ho_Chi_Minh')::date),((tick at time zone 'Asia/Ho_Chi_Minh')::date-1)) dates(local_date)
    left join public.n3vjit_reminder_deliveries d on d.user_id=r.user_id and d.local_date=dates.local_date
    where r.enabled and u.email_confirmed_at is not null and u.email is not null
      and extract(dow from dates.local_date)::integer=any(r.weekdays)
      and (dates.local_date+r.day_times[extract(dow from dates.local_date)::integer+1]) at time zone 'Asia/Ho_Chi_Minh' between tick-interval '15 minutes' and tick
      and (d.id is null or (d.status in ('processing','failed') and d.attempts<3 and d.claimed_at<tick-case when d.status='processing' then interval '5 minutes' else interval '2 minutes' end))
    order by due_at,r.user_id for update of r skip locked
  loop
    insert into public.n3vjit_reminder_deliveries(user_id,local_date,due_at,preference_version,recipient,unsubscribe_token)
      values(candidate.user_id,candidate.local_date,candidate.due_at,candidate.updated_at,candidate.email,candidate.unsubscribe_token)
      on conflict(user_id,local_date) do update set status='processing',attempts=public.n3vjit_reminder_deliveries.attempts+1,claimed_at=tick
      where public.n3vjit_reminder_deliveries.status in ('processing','failed') and public.n3vjit_reminder_deliveries.attempts<3
        and public.n3vjit_reminder_deliveries.claimed_at<tick-case when public.n3vjit_reminder_deliveries.status='processing' then interval '5 minutes' else interval '2 minutes' end
      returning * into job;
    if found then return to_jsonb(job); end if;
  end loop;
  return null;
end;
$$;

create or replace function public.n3vjit_claim_push_reminder() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare candidate record; job public.n3vjit_push_deliveries; tick timestamptz:=clock_timestamp();
begin
  if not coalesce((select enabled from public.n3vjit_push_runtime where id),false) then return null; end if;
  for candidate in
    select s.*,r.push_updated_at preference_version,dates.local_date,
      (dates.local_date+r.day_times[extract(dow from dates.local_date)::integer+1]) at time zone 'Asia/Ho_Chi_Minh' due_at
    from public.n3vjit_push_subscriptions s join public.n3vjit_study_reminders r on r.user_id=s.user_id
    cross join lateral (values ((tick at time zone 'Asia/Ho_Chi_Minh')::date),((tick at time zone 'Asia/Ho_Chi_Minh')::date-1)) dates(local_date)
    left join public.n3vjit_push_deliveries d on d.subscription_id=s.id and d.local_date=dates.local_date
    where r.push_enabled and extract(dow from dates.local_date)::integer=any(r.weekdays)
      and (dates.local_date+r.day_times[extract(dow from dates.local_date)::integer+1]) at time zone 'Asia/Ho_Chi_Minh' between tick-interval '15 minutes' and tick
      and (d.id is null or (d.status in ('processing','failed') and d.attempts<3 and d.claimed_at<tick-case when d.status='processing' then interval '5 minutes' else interval '2 minutes' end))
    order by due_at,s.id for update of s skip locked
  loop
    insert into public.n3vjit_push_deliveries(user_id,subscription_id,local_date,due_at,preference_version)
      values(candidate.user_id,candidate.id,candidate.local_date,candidate.due_at,candidate.preference_version)
      on conflict(subscription_id,local_date) do update set status='processing',attempts=public.n3vjit_push_deliveries.attempts+1,claimed_at=tick
      where public.n3vjit_push_deliveries.status in ('processing','failed') and public.n3vjit_push_deliveries.attempts<3
        and public.n3vjit_push_deliveries.claimed_at<tick-case when public.n3vjit_push_deliveries.status='processing' then interval '5 minutes' else interval '2 minutes' end
      returning * into job;
    if found then return jsonb_build_object('job',to_jsonb(job),'subscription',to_jsonb(candidate)); end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.n3vjit_save_reminder(boolean,text,text,integer[],text[]) from public,anon,authenticated;
grant execute on function public.n3vjit_save_reminder(boolean,text,text,integer[],text[]) to authenticated;
