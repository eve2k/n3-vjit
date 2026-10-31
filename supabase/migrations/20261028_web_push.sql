-- Web Push is an independent opt-in channel. Apply once as the database owner.
create table public.n3vjit_push_runtime (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  vapid_public_key text
);
insert into public.n3vjit_push_runtime default values;

alter table public.n3vjit_study_reminders add column push_enabled boolean not null default false;
alter table public.n3vjit_study_reminders add column push_updated_at timestamptz not null default clock_timestamp();

create table public.n3vjit_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  device_id text not null,
  device_name text not null default 'Thiết bị',
  last_success_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(user_id, endpoint), unique(user_id, device_id)
);
create index n3vjit_push_subscriptions_user on public.n3vjit_push_subscriptions(user_id);
create table public.n3vjit_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.n3vjit_push_subscriptions(id) on delete cascade,
  local_date date not null,
  due_at timestamptz not null,
  preference_version timestamptz not null,
  status text not null default 'processing' check(status in ('processing','sent','failed','cancelled')),
  attempts integer not null default 1,
  claimed_at timestamptz not null default clock_timestamp(),
  unique(subscription_id, local_date)
);
create index n3vjit_push_due on public.n3vjit_push_deliveries(due_at);
create table public.n3vjit_push_test_ledger (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_requested_at timestamptz not null
);

alter table public.n3vjit_push_runtime enable row level security;
alter table public.n3vjit_push_subscriptions enable row level security;
alter table public.n3vjit_push_deliveries enable row level security;
alter table public.n3vjit_push_test_ledger enable row level security;
revoke all on public.n3vjit_push_runtime, public.n3vjit_push_subscriptions,
  public.n3vjit_push_deliveries, public.n3vjit_push_test_ledger from public, anon, authenticated;
grant all on public.n3vjit_push_runtime, public.n3vjit_push_subscriptions,
  public.n3vjit_push_deliveries, public.n3vjit_push_test_ledger to service_role;

create or replace function public.n3vjit_get_reminder() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ready', coalesce((select enabled from public.n3vjit_reminder_runtime where id), false),
    'push_ready', coalesce((select enabled and vapid_public_key is not null from public.n3vjit_push_runtime where id), false),
    'vapid_public_key', (select vapid_public_key from public.n3vjit_push_runtime where id),
    'settings', (select jsonb_build_object('enabled', r.enabled, 'push_enabled', r.push_enabled,
      'local_time', left(r.local_time::text, 5), 'timezone', r.timezone, 'weekdays', r.weekdays)
      from public.n3vjit_study_reminders r where r.user_id = auth.uid()),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'device_name', s.device_name,
      'created_at', s.created_at, 'last_success_at', s.last_success_at)
      order by s.created_at) from public.n3vjit_push_subscriptions s where s.user_id = auth.uid()), '[]'::jsonb)
  );
$$;

-- Preserve the existing email RPC contract while versioning push schedule changes separately.
create or replace function public.n3vjit_save_reminder(p_enabled boolean,p_local_time text,p_timezone text,p_weekdays integer[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_row public.n3vjit_study_reminders;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_enabled is null or p_local_time is null or p_local_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or p_timezone is null or not exists(select 1 from pg_timezone_names where name=p_timezone)
    or p_weekdays is null or cardinality(p_weekdays) not between 1 and 7
    or exists(select 1 from unnest(p_weekdays) d where d is null or d<0 or d>6)
    or cardinality(p_weekdays)<>(select count(distinct d) from unnest(p_weekdays) d)
    then raise exception 'Invalid reminder settings'; end if;
  if p_enabled and (not coalesce((select enabled from public.n3vjit_reminder_runtime where id),false)
    or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and email is not null))
    then raise exception 'Email reminders are not ready'; end if;
  select * into current_row from public.n3vjit_study_reminders where user_id=auth.uid();
  insert into public.n3vjit_study_reminders(user_id,enabled,local_time,timezone,weekdays)
    values(auth.uid(),p_enabled,p_local_time::time,p_timezone,p_weekdays)
    on conflict(user_id) do update set enabled=excluded.enabled,local_time=excluded.local_time,
      timezone=excluded.timezone,weekdays=excluded.weekdays,updated_at=clock_timestamp(),
      push_updated_at=case when (current_row.local_time,current_row.timezone,current_row.weekdays)
        is distinct from (excluded.local_time,excluded.timezone,excluded.weekdays)
        then clock_timestamp() else public.n3vjit_study_reminders.push_updated_at end;
  return public.n3vjit_get_reminder();
end;
$$;

create function public.n3vjit_save_push_subscription(p_endpoint text,p_p256dh text,p_auth text,p_device_id text,p_device_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); found_id uuid; device_count integer;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_endpoint is null or length(p_endpoint) not between 20 and 2048 or p_endpoint !~* '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)(/|\?|$)'
    then raise exception 'Invalid push endpoint'; end if;
  if p_p256dh is null or p_auth is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}=?$' or p_auth !~ '^[A-Za-z0-9_-]{22}={0,2}$'
    then raise exception 'Invalid push encryption keys'; end if;
  if p_device_id is null or p_device_name is null or p_device_id !~ '^[a-zA-Z0-9-]{8,80}$' or length(p_device_name) not between 1 and 80
    then raise exception 'Invalid push device'; end if;
  if not coalesce((select enabled and vapid_public_key is not null from public.n3vjit_push_runtime where id),false)
    then raise exception 'Push is not ready'; end if;
  -- Serialize account-level registration so endpoint/device-id races cannot bypass the cap.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  select s.id into found_id from public.n3vjit_push_subscriptions s
    where s.user_id=uid and (s.endpoint=p_endpoint or s.device_id=p_device_id)
    order by (s.endpoint=p_endpoint) desc limit 1 for update;
  if found_id is null then
    delete from public.n3vjit_push_subscriptions where user_id=uid
      and coalesce(last_success_at,created_at) < clock_timestamp()-interval '30 days';
    select count(*) into device_count from public.n3vjit_push_subscriptions where user_id=uid;
    if device_count >= 5 then raise exception 'Device limit reached'; end if;
    insert into public.n3vjit_push_subscriptions(user_id,endpoint,p256dh,auth,device_id,device_name)
      values(uid,p_endpoint,p_p256dh,p_auth,p_device_id,p_device_name) returning id into found_id;
  else
    delete from public.n3vjit_push_subscriptions where user_id=uid and id<>found_id
      and (endpoint=p_endpoint or device_id=p_device_id);
    update public.n3vjit_push_subscriptions set endpoint=p_endpoint,p256dh=p_p256dh,auth=p_auth,
      device_id=p_device_id,device_name=p_device_name,updated_at=clock_timestamp()
      where id=found_id returning id into found_id;
  end if;
  if not exists(select 1 from public.n3vjit_study_reminders where user_id=uid) then
    insert into public.n3vjit_study_reminders(user_id,enabled,push_enabled)
      values(uid,false,true) on conflict(user_id) do update set push_enabled=true,push_updated_at=clock_timestamp();
  else update public.n3vjit_study_reminders set push_enabled=true,push_updated_at=clock_timestamp() where user_id=uid; end if;
  return public.n3vjit_get_reminder();
end;
$$;

create function public.n3vjit_set_push_enabled(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_enabled and (not coalesce((select enabled and vapid_public_key is not null from public.n3vjit_push_runtime where id),false)
    or not exists(select 1 from public.n3vjit_push_subscriptions where user_id=auth.uid())) then raise exception 'Push setup required'; end if;
  update public.n3vjit_study_reminders set push_enabled=p_enabled,push_updated_at=clock_timestamp() where user_id=auth.uid();
  if not found and not p_enabled then return public.n3vjit_get_reminder(); end if;
  if not found then insert into public.n3vjit_study_reminders(user_id,push_enabled) values(auth.uid(),p_enabled); end if;
  return public.n3vjit_get_reminder();
end;
$$;

create function public.n3vjit_delete_push_subscription(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.n3vjit_push_subscriptions where id=p_id and user_id=auth.uid();
  if not exists(select 1 from public.n3vjit_push_subscriptions where user_id=auth.uid()) then
    update public.n3vjit_study_reminders set push_enabled=false,push_updated_at=clock_timestamp() where user_id=auth.uid();
  end if;
  return public.n3vjit_get_reminder();
end;
$$;
create function public.n3vjit_expire_push_subscription(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.n3vjit_push_subscriptions where id=p_id;
$$;

create function public.n3vjit_claim_push_test(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := p_user_id; now_at timestamptz := clock_timestamp(); last_at timestamptz; granted_at timestamptz;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.n3vjit_study_reminders where user_id=uid and push_enabled) then raise exception 'Push is off'; end if;
  insert into public.n3vjit_push_test_ledger(user_id,last_requested_at) values(uid,now_at)
    on conflict(user_id) do update set last_requested_at=excluded.last_requested_at
    where public.n3vjit_push_test_ledger.last_requested_at < now_at-interval '1 minute'
    returning last_requested_at into granted_at;
  if not found then
    select last_requested_at into last_at from public.n3vjit_push_test_ledger where user_id=uid;
    return jsonb_build_object('rate_limited',true,'retry_after',greatest(1,ceil(extract(epoch from (last_at+interval '1 minute'-now_at)))::integer));
  end if;
  return (select jsonb_agg(to_jsonb(s)) from public.n3vjit_push_subscriptions s where s.user_id=uid);
end;
$$;

create function public.n3vjit_claim_push_reminder() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare candidate record; job public.n3vjit_push_deliveries; tick timestamptz:=clock_timestamp();
begin
  if not coalesce((select enabled from public.n3vjit_push_runtime where id),false) then return null; end if;
  for candidate in
    select s.*,r.push_updated_at preference_version,dates.local_date,(dates.local_date+r.local_time) at time zone r.timezone due_at
    from public.n3vjit_push_subscriptions s join public.n3vjit_study_reminders r on r.user_id=s.user_id
    cross join lateral (values ((tick at time zone r.timezone)::date),((tick at time zone r.timezone)::date-1)) dates(local_date)
    left join public.n3vjit_push_deliveries d on d.subscription_id=s.id and d.local_date=dates.local_date
    where r.push_enabled and extract(dow from dates.local_date)::integer=any(r.weekdays)
      and (dates.local_date+r.local_time) at time zone r.timezone between tick-interval '15 minutes' and tick
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

create function public.n3vjit_finish_push(p_id uuid,p_status text) returns void
language sql security definer set search_path = '' as $$
  update public.n3vjit_push_deliveries set status=p_status where id=p_id and status='processing' and p_status in ('sent','failed','cancelled');
$$;
create function public.n3vjit_prepare_push(p_id uuid,p_attempt integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job public.n3vjit_push_deliveries; subscription public.n3vjit_push_subscriptions;
begin
  select * into job from public.n3vjit_push_deliveries where id=p_id and attempts=p_attempt and status='processing' for update;
  if not found then return null; end if;
  if not coalesce((select enabled from public.n3vjit_push_runtime where id),false)
    or job.due_at < clock_timestamp()-interval '15 minutes'
    or not exists(select 1 from public.n3vjit_study_reminders r where r.user_id=job.user_id
      and r.push_enabled and r.push_updated_at=job.preference_version)
    or not exists(select 1 from public.n3vjit_push_subscriptions s where s.id=job.subscription_id and s.user_id=job.user_id)
    then update public.n3vjit_push_deliveries set status='cancelled' where id=job.id; return null; end if;
  select * into subscription from public.n3vjit_push_subscriptions where id=job.subscription_id;
  return jsonb_build_object('job',to_jsonb(job),'subscription',to_jsonb(subscription));
end;
$$;
create function public.n3vjit_mark_push_success(p_subscription_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.n3vjit_push_subscriptions set last_success_at=clock_timestamp() where id=p_subscription_id;
$$;

revoke all on function public.n3vjit_save_push_subscription(text,text,text,text,text),public.n3vjit_set_push_enabled(boolean),
  public.n3vjit_delete_push_subscription(uuid),public.n3vjit_claim_push_test(uuid),public.n3vjit_claim_push_reminder(),
  public.n3vjit_finish_push(uuid,text),public.n3vjit_prepare_push(uuid,integer),public.n3vjit_mark_push_success(uuid),
  public.n3vjit_expire_push_subscription(uuid) from public,anon,authenticated;
grant execute on function public.n3vjit_save_push_subscription(text,text,text,text,text),public.n3vjit_set_push_enabled(boolean),
  public.n3vjit_delete_push_subscription(uuid) to authenticated;
grant execute on function public.n3vjit_claim_push_reminder(),public.n3vjit_finish_push(uuid,text),public.n3vjit_prepare_push(uuid,integer),
  public.n3vjit_mark_push_success(uuid),public.n3vjit_claim_push_test(uuid),
  public.n3vjit_expire_push_subscription(uuid) to service_role;
