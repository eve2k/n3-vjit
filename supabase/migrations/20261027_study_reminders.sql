-- Run once, as database owner. Does not activate sending or install a cron job.
create table public.n3vjit_reminder_runtime (
  id boolean primary key default true check (id),
  enabled boolean not null default false
);
insert into public.n3vjit_reminder_runtime default values;

create table public.n3vjit_study_reminders (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  local_time time(0) not null default '20:00',
  timezone text not null default 'Asia/Ho_Chi_Minh',
  weekdays integer[] not null default array[0,1,2,3,4,5,6],
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  updated_at timestamptz not null default clock_timestamp()
);
create table public.n3vjit_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.n3vjit_study_reminders(user_id) on delete cascade,
  local_date date not null,
  due_at timestamptz not null,
  preference_version timestamptz not null,
  recipient text not null,
  unsubscribe_token uuid not null,
  status text not null default 'processing' check (status in ('processing','sent','failed','cancelled')),
  attempts integer not null default 1,
  claimed_at timestamptz not null default clock_timestamp(),
  payload jsonb,
  provider_id text,
  unique (user_id, local_date)
);
create index on public.n3vjit_reminder_deliveries(due_at);

alter table public.n3vjit_reminder_runtime enable row level security;
alter table public.n3vjit_study_reminders enable row level security;
alter table public.n3vjit_reminder_deliveries enable row level security;
-- All access goes through RPCs; hidden tokens/ledger are never readable by users.
revoke all on public.n3vjit_reminder_runtime, public.n3vjit_study_reminders, public.n3vjit_reminder_deliveries from public, anon, authenticated;
grant all on public.n3vjit_reminder_runtime, public.n3vjit_study_reminders, public.n3vjit_reminder_deliveries to service_role;

create function public.n3vjit_get_reminder() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ready', coalesce((select enabled from public.n3vjit_reminder_runtime where id), false),
    'settings', (select jsonb_build_object('enabled', r.enabled, 'local_time', left(r.local_time::text, 5),
      'timezone', r.timezone, 'weekdays', r.weekdays)
      from public.n3vjit_study_reminders r where r.user_id = auth.uid())
  );
$$;

create function public.n3vjit_save_reminder(p_enabled boolean, p_local_time text, p_timezone text, p_weekdays integer[])
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_enabled is null or p_local_time is null or p_local_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or p_timezone is null or not exists (select 1 from pg_timezone_names where name = p_timezone)
    or p_weekdays is null or cardinality(p_weekdays) not between 1 and 7
    or exists (select 1 from unnest(p_weekdays) d where d is null or d < 0 or d > 6)
    or cardinality(p_weekdays) <> (select count(distinct d) from unnest(p_weekdays) d)
    then raise exception 'Invalid reminder settings'; end if;
  if p_enabled and (not coalesce((select enabled from public.n3vjit_reminder_runtime where id), false)
    or not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null and email is not null))
    then raise exception 'Email reminders are not ready'; end if;
  insert into public.n3vjit_study_reminders(user_id, enabled, local_time, timezone, weekdays)
    values(auth.uid(), p_enabled, p_local_time::time, p_timezone, p_weekdays)
    on conflict(user_id) do update set enabled = excluded.enabled, local_time = excluded.local_time,
      timezone = excluded.timezone, weekdays = excluded.weekdays, updated_at = clock_timestamp();
  return public.n3vjit_get_reminder();
end;
$$;

-- Claims one due delivery atomically. Late jobs expire after 15 minutes; no backlog email storm.
-- Two local dates account for retries crossing midnight in the user's timezone.
create function public.n3vjit_claim_reminder() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare candidate record; job public.n3vjit_reminder_deliveries; tick timestamptz := clock_timestamp();
begin
  if not coalesce((select enabled from public.n3vjit_reminder_runtime where id), false) then return null; end if;
  for candidate in
    select r.*, u.email, dates.local_date, (dates.local_date + r.local_time) at time zone r.timezone as due_at
    from public.n3vjit_study_reminders r join auth.users u on u.id = r.user_id
    cross join lateral (values ((tick at time zone r.timezone)::date), ((tick at time zone r.timezone)::date - 1)) dates(local_date)
    left join public.n3vjit_reminder_deliveries d on d.user_id = r.user_id and d.local_date = dates.local_date
    where r.enabled and u.email_confirmed_at is not null and u.email is not null
      and extract(dow from dates.local_date)::integer = any(r.weekdays)
      and (dates.local_date + r.local_time) at time zone r.timezone between tick - interval '15 minutes' and tick
      and (d.id is null or (d.status in ('processing','failed') and d.attempts < 3
        and d.claimed_at < tick - case when d.status = 'processing' then interval '5 minutes' else interval '2 minutes' end))
    order by due_at, r.user_id for update of r skip locked
  loop
    insert into public.n3vjit_reminder_deliveries(user_id, local_date, due_at, preference_version, recipient, unsubscribe_token)
      values(candidate.user_id, candidate.local_date, candidate.due_at, candidate.updated_at, candidate.email, candidate.unsubscribe_token)
      on conflict(user_id, local_date) do update set status = 'processing', attempts = public.n3vjit_reminder_deliveries.attempts + 1, claimed_at = tick
      where public.n3vjit_reminder_deliveries.status in ('processing','failed')
        and public.n3vjit_reminder_deliveries.attempts < 3
        and public.n3vjit_reminder_deliveries.claimed_at < tick - case when public.n3vjit_reminder_deliveries.status = 'processing' then interval '5 minutes' else interval '2 minutes' end
      returning * into job;
    if found then return to_jsonb(job); end if;
  end loop;
  return null;
end;
$$;

-- Recheck consent immediately before sending and persist the original provider payload for retries.
create function public.n3vjit_prepare_reminder(p_id uuid, p_attempt integer, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job public.n3vjit_reminder_deliveries;
begin
  select * into job from public.n3vjit_reminder_deliveries where id = p_id and attempts = p_attempt and status = 'processing' for update;
  if not found then return null; end if;
  if not coalesce((select enabled from public.n3vjit_reminder_runtime where id), false)
    or job.due_at < clock_timestamp() - interval '15 minutes'
    or not exists(select 1 from public.n3vjit_study_reminders r join auth.users u on u.id = r.user_id
      where r.user_id = job.user_id and r.enabled and r.updated_at = job.preference_version
        and u.email = job.recipient and u.email_confirmed_at is not null)
    then update public.n3vjit_reminder_deliveries set status = 'cancelled' where id = job.id; return null; end if;
  update public.n3vjit_reminder_deliveries set payload = coalesce(payload, p_payload) where id = job.id returning * into job;
  return job.payload;
end;
$$;

create function public.n3vjit_finish_reminder(p_id uuid, p_attempt integer, p_provider_id text) returns void
language sql security definer set search_path = '' as $$
  update public.n3vjit_reminder_deliveries set status = case when p_provider_id is null then 'failed' else 'sent' end,
    provider_id = p_provider_id where id = p_id and attempts = p_attempt and status = 'processing';
$$;

create function public.n3vjit_unsubscribe_reminder(p_token uuid) returns void
language sql security definer set search_path = '' as $$
  update public.n3vjit_study_reminders set enabled = false, updated_at = clock_timestamp() where unsubscribe_token = p_token;
$$;

revoke all on function public.n3vjit_get_reminder(), public.n3vjit_save_reminder(boolean,text,text,integer[]),
  public.n3vjit_claim_reminder(), public.n3vjit_prepare_reminder(uuid,integer,jsonb),
  public.n3vjit_finish_reminder(uuid,integer,text), public.n3vjit_unsubscribe_reminder(uuid) from public, anon, authenticated;
grant execute on function public.n3vjit_get_reminder(), public.n3vjit_save_reminder(boolean,text,text,integer[]) to authenticated;
grant execute on function public.n3vjit_claim_reminder(), public.n3vjit_prepare_reminder(uuid,integer,jsonb),
  public.n3vjit_finish_reminder(uuid,integer,text), public.n3vjit_unsubscribe_reminder(uuid) to service_role;
