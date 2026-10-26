create schema if not exists n3vjit_private;
revoke all on schema n3vjit_private from public, anon, authenticated;

create table if not exists n3vjit_private.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default clock_timestamp(),
  granted_by uuid references auth.users(id) on delete set null
);

alter table n3vjit_private.admin_roles enable row level security;
revoke all on n3vjit_private.admin_roles from public, anon, authenticated;

-- Bootstrap an existing account only. If it does not exist yet, the project owner
-- can run the documented one-time grant statement after verifying that account.
insert into n3vjit_private.admin_roles(user_id)
select id from auth.users
where lower(email) = 'nguyeenhuynhlong@gmail.com'
on conflict (user_id) do nothing;

create or replace function public.n3vjit_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from n3vjit_private.admin_roles r
    where r.user_id = (select auth.uid())
  );
$$;

create or replace function public.n3vjit_admin_list_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  email_confirmed boolean,
  is_admin boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from n3vjit_private.admin_roles r where r.user_id = (select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  return query
    select u.id, u.email::text, coalesce(u.raw_user_meta_data ->> 'display_name', ''),
           u.created_at, u.email_confirmed_at is not null,
           exists (select 1 from n3vjit_private.admin_roles r where r.user_id = u.id)
    from auth.users u
    where u.email is not null
    order by u.created_at desc;
end;
$$;

create or replace function public.n3vjit_admin_set_role(p_email text, p_is_admin boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_id uuid;
  admin_count bigint;
begin
  perform pg_advisory_xact_lock(742831915);
  if actor_id is null or not exists (select 1 from n3vjit_private.admin_roles r where r.user_id = actor_id) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  select id into target_id from auth.users where lower(email) = lower(trim(p_email));
  if target_id is null then
    raise exception using errcode = 'P0002', message = 'user_not_found';
  end if;

  if p_is_admin then
    insert into n3vjit_private.admin_roles(user_id, granted_by)
    values (target_id, actor_id)
    on conflict (user_id) do nothing;
  else
    select count(*) into admin_count from n3vjit_private.admin_roles;
    if exists (select 1 from n3vjit_private.admin_roles where user_id = target_id) and admin_count <= 1 then
      raise exception using errcode = 'P0001', message = 'last_admin';
    end if;
    delete from n3vjit_private.admin_roles where user_id = target_id;
  end if;

  return true;
end;
$$;

revoke all on function public.n3vjit_is_admin() from public, anon;
revoke all on function public.n3vjit_admin_list_users() from public, anon;
revoke all on function public.n3vjit_admin_set_role(text, boolean) from public, anon;
grant execute on function public.n3vjit_is_admin() to authenticated;
grant execute on function public.n3vjit_admin_list_users() to authenticated;
grant execute on function public.n3vjit_admin_set_role(text, boolean) to authenticated;

notify pgrst, 'reload schema';
