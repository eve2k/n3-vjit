create table if not exists public.n3vjit_study_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.n3vjit_study_progress enable row level security;
revoke all on public.n3vjit_study_progress from anon;
grant select, insert, update on public.n3vjit_study_progress to authenticated;

create policy "Read own study progress"
  on public.n3vjit_study_progress for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Create own study progress"
  on public.n3vjit_study_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Update own study progress"
  on public.n3vjit_study_progress for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.touch_n3vjit_study_progress()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create trigger n3vjit_study_progress_updated
  before update on public.n3vjit_study_progress
  for each row execute function public.touch_n3vjit_study_progress();
