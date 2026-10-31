# Web Push

Web Push is an independent, opt-in reminder channel. Email continues to use its existing Resend configuration and may be enabled with push or by itself. Neither channel is enabled by default.

## Apply and deploy

1. Run `supabase/migrations/20261028_web_push.sql` once, then `supabase/migrations/20261028_web_push_fix.sql`, then `supabase/migrations/20261028_web_push_endpoint_allowlist.sql` in the Supabase SQL Editor as project owner. The follow-ups repair subscription upserts and constrain endpoints to supported push-service hosts with HTTPS and Web Push key format checks. These migrations add a separate runtime flag, subscriptions, a push delivery ledger, per-user device management RPCs, and a one-per-minute test-send ledger. They do not enable sending.
2. Generate a VAPID key pair using a trusted Web Push key generator. Set the following Edge Function secrets; the public key is returned to authenticated users by `n3vjit_get_reminder` and is safe for the browser.

   | Secret | Value |
   | --- | --- |
   | `VAPID_PUBLIC_KEY` | Base64url encoded uncompressed P-256 public key |
   | `VAPID_PRIVATE_KEY` | VAPID private key; keep in Edge Function secrets only |
   | `VAPID_SUBJECT` | A valid `mailto:you@example.com` or HTTPS contact URL; the Edge Function rejects other values with `invalid_vapid_subject` |

3. Enable push sending after setting the secrets:

   ```sql
   update public.n3vjit_push_runtime
   set enabled = true, vapid_public_key = 'YOUR_PUBLIC_KEY'
   where id;
   ```

4. Deploy the existing function with Supabase CLI:

   ```bash
   supabase functions deploy study-reminders --no-verify-jwt
   ```

   Keep the existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REMINDER_CRON_SECRET`, and `APP_URL` secrets. Email reminders additionally require the existing `RESEND_API_KEY` and `RESEND_FROM`. The function imports the pinned `npm:@block65/webcrypto-web-push@2.0.0` package, which uses Web Crypto and the RFC 8291/8292 `aes128gcm`/VAPID scheme.

5. Keep the existing `n3vjit-study-reminders` cron job. It now claims push deliveries separately from email. The push runtime flag is independent of the email runtime flag.

## User setup

Sign in and open **Tài khoản**. Choose the reminder time, weekdays, and timezone, then select **Nhắc bằng thông báo push**. Browser notification permission is requested only after that click. The first accepted push is a confirmation; **Gửi thử lại** can be used again after one minute. Test pushes use a separate tag and never count as a scheduled daily reminder. The function's accepted result means the push service accepted the request, not that the device displayed it.

Up to five subscriptions are kept per user. A matching endpoint or browser device identifier updates the existing row. Before rejecting a new device at the limit, subscriptions without a successful push in 30 days are removed. Devices can also be deleted from the account page. Removing the last device disables push for that account while leaving email settings untouched.

On iPhone with iOS 16.4 or newer, install the site using **Share → Add to Home Screen**, open it from the Home Screen, then allow notifications when asked. If permission was previously denied, re-enable notifications in the browser/site settings and return to the account page.

### Send an immediate device test

In **Tài khoản → Nhắc giờ học**, use **Gửi thông báo thử ngay**. This authenticated action sends only to the signed-in account's registered devices, independent of the saved reminder time and weekdays. It has a one-request-per-minute limit and does not create or consume a scheduled daily delivery. A successful response means the push service accepted the request; it does not prove that iOS displayed it. This tests device delivery, not the cron schedule.

## Security and operations

Subscription tables and delivery ledgers use RLS and deny direct access to `anon` and `authenticated`; owner-checked security-definer RPCs expose only account-scoped operations. The cron and test sender use the service role inside the Edge Function. Browser CORS is restricted to the origin derived from `APP_URL`. Subscription endpoints are restricted to HTTPS push-service hosts for Apple, Google, Mozilla, and Microsoft; endpoint and Web Push key lengths/formats are validated by the save RPC. The VAPID private key and subject must never be placed in `VITE_*` variables, the repository, or browser code. Only the public key is client-visible.

Scheduled pushes use a one-hour TTL, an atomic per-device/per-local-date claim, the existing 15-minute due window, and independent retry state. Push service responses 404/410 remove expired subscriptions; transient failures remain retryable. Push does not depend on email verification or Resend. When both channels are selected, stage 2 sends both channels independently.

If push sending needs to stop, run:

```sql
update public.n3vjit_push_runtime set enabled = false where id;
```

This stops push only; email reminders remain governed by `n3vjit_reminder_runtime`.

## Push-only requirements and troubleshooting

The `study-reminders` cron route enters its push loop when all of these are true:

- The request passes the `REMINDER_CRON_SECRET` check. The Vault value `n3vjit_reminder_cron_secret` must exactly match the Edge Function secret; the secret must be at least 32 characters.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `APP_URL` are present in the Edge Function. The project URL and service role key are Supabase Edge Function secrets; `APP_URL` is the public HTTPS website origin.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and valid `VAPID_SUBJECT` are present in Edge Function secrets. The public key must match `n3vjit_push_runtime.vapid_public_key`.
- `public.n3vjit_push_runtime.enabled` is true, the user's `push_enabled` is true, and at least one device subscription exists.
- The cron job runs once a minute. The scheduled local time must be within the previous 15 minutes and the local weekday must be selected. Claiming is atomic, and a subscription can have one delivery row per local calendar day. Failed sends can retry up to three attempts within the delivery window.

The email runtime flag `public.n3vjit_reminder_runtime.enabled`, email verification, `RESEND_API_KEY`, and `RESEND_FROM` are **not required** for push-only. The cron request still requires `REMINDER_CRON_SECRET`; push-only does not bypass cron authentication. When email is disabled, the email claim RPC returns no email job and the handler continues to the separate push claim loop.

Run these read-only queries in the Supabase SQL Editor as a project administrator. Replace `your-login-email@example.com` with your account email. These queries intentionally do not select subscription endpoints or encryption keys.

```sql
-- 1) Saved schedule, channel flags and runtime switches.
select user_id, enabled as email_enabled, push_enabled, local_time, timezone,
       weekdays, updated_at, push_updated_at
from public.n3vjit_study_reminders
where user_id = (select id from auth.users where email = 'your-login-email@example.com');

select (select enabled from public.n3vjit_reminder_runtime where id) as email_runtime_enabled,
       (select enabled from public.n3vjit_push_runtime where id) as push_runtime_enabled,
       (select vapid_public_key is not null from public.n3vjit_push_runtime where id) as public_key_present;

-- 2) Confirm the minute-by-minute scheduler exists and is active.
select jobid, jobname, schedule, active
from cron.job
where jobname in ('n3vjit-study-reminders', 'n3vjit-reminder-cleanup');

-- 3) Recent cron executions for the reminder worker.
select d.runid, j.jobname, d.status, d.return_message, d.start_time, d.end_time
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname = 'n3vjit-study-reminders'
order by d.start_time desc
limit 20;

-- 4) Recent worker HTTP responses from pg_net (status/error only; no payload or headers).
select r.id, r.status_code, r.timed_out, r.error_msg, r.created
from net._http_response r
join net._http_request q on q.id = r.id
where q.url like '%/functions/v1/study-reminders'
order by r.created desc
limit 20;

-- 5) Push ledger for this account (status fields only; no endpoint or keys).
select user_id, local_date, due_at, status, attempts, claimed_at
from public.n3vjit_push_deliveries
where user_id = (select id from auth.users where email = 'your-login-email@example.com')
order by due_at desc
limit 20;
```

How to read the results:

- No schedule row means the account has not saved its reminder settings. For push-only, `push_enabled` must be true; `email_enabled` can be false. Push runtime must be true and `public_key_present` must be true.
- The cron job should show `active = true` and schedule `* * * * *`. `cron.job_run_details.status` should usually be `succeeded`; failures and `return_message` point to scheduler/database errors.
- A recent `net._http_response.status_code` in the 2xx range means the Edge Function HTTP request completed. It does not prove that a push was accepted for a device; inspect the push ledger and the Edge Function logs for per-send counts. `timed_out` or `error_msg` indicates a `pg_net` request problem.
- No push ledger row means the worker has not claimed a scheduled delivery for that device and local date. Check runtime, channel, device registration, weekday, due time/timezone, cron health, and the 15-minute window.
- `processing` means claimed/in progress; an abandoned claim can be retried after its lease. `sent` means the push service accepted the request. `failed` is retryable up to three attempts while still within the 15-minute window. `cancelled` means the subscription or schedule became ineligible, or the due window expired. `sent` does not guarantee the phone displayed the notification.

To diagnose a missed reminder, compare `due_at` with `start_time` and the saved timezone. If the worker did not run until more than 15 minutes after the due time, it intentionally skips that reminder rather than sending a stale notification. A push service `404`/`410` removes the expired subscription; transient `429`/`5xx` results are retried while the window and attempt limit allow.
