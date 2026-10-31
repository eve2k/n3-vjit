-- Harden device registration for projects that have already applied the Web Push migrations.
create or replace function public.n3vjit_save_push_subscription(p_endpoint text,p_p256dh text,p_auth text,p_device_id text,p_device_name text)
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
