create schema if not exists n3vjit_private;
revoke all on schema n3vjit_private from public, anon, authenticated;

create table if not exists n3vjit_private.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table n3vjit_private.settings enable row level security;
revoke all on n3vjit_private.settings from public, anon, authenticated;

insert into n3vjit_private.settings(key, value)
values ('exam_date', to_jsonb('2026-11-21'::text))
on conflict (key) do nothing;

create or replace function public.n3vjit_get_exam_date()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.value #>> '{}' from n3vjit_private.settings s where s.key = 'exam_date';
$$;

create or replace function public.n3vjit_set_exam_date(p_exam_date text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null or not exists (select 1 from n3vjit_private.admin_roles r where r.user_id = actor_id) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  if p_exam_date !~ '^\d{4}-\d{2}-\d{2}$' or to_char(p_exam_date::date, 'YYYY-MM-DD') <> p_exam_date or p_exam_date <= to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') then
    raise exception using errcode = '22023', message = 'invalid_exam_date';
  end if;
  insert into n3vjit_private.settings(key, value, updated_at, updated_by)
  values ('exam_date', to_jsonb(p_exam_date), clock_timestamp(), actor_id)
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return p_exam_date;
end;
$$;

revoke all on function public.n3vjit_get_exam_date() from public;
revoke all on function public.n3vjit_set_exam_date(text) from public, anon;
grant execute on function public.n3vjit_get_exam_date() to anon, authenticated;
grant execute on function public.n3vjit_set_exam_date(text) to authenticated;

notify pgrst, 'reload schema';
