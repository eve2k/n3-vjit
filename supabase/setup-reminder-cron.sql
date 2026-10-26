-- Run only AFTER deploying/configuring the function, and creating these Vault secrets:
-- n3vjit_project_url = https://YOUR_PROJECT.supabase.co
-- n3vjit_reminder_cron_secret = the exact REMINDER_CRON_SECRET (random, >=32 chars)
-- Use the Vault dashboard; do not commit real secret values into this file.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$ begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'n3vjit_project_url')
    or not exists (select 1 from vault.decrypted_secrets where name = 'n3vjit_reminder_cron_secret')
    then raise exception 'Create the two reminder Vault secrets first'; end if;
end $$;

select cron.schedule('n3vjit-study-reminders', '* * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'n3vjit_project_url') || '/functions/v1/study-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'n3vjit_reminder_cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 60000
  );
$cron$);

select cron.schedule('n3vjit-reminder-cleanup', '15 3 * * *', $cron$
  delete from public.n3vjit_reminder_deliveries where due_at < now() - interval '30 days';
$cron$);

-- FINAL STEP, run separately after checking the function and cron configuration:
-- update public.n3vjit_reminder_runtime set enabled = true where id;
-- Emergency stop (preserves users' schedules):
-- update public.n3vjit_reminder_runtime set enabled = false where id;
