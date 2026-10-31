import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAuthClient } from '../services/authClient.js'
import { DEFAULT_REMINDER, validateReminder } from './studyReminders.js'
import { createReminderHandler } from '../../supabase/functions/study-reminders/handler.mjs'

const secret = 'a-random-test-secret-with-at-least-32-characters'
const token = '9986a63c-8cc1-4da8-a219-2d9a0e2579bc'
const values = { REMINDER_CRON_SECRET: secret, SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-only-test', RESEND_API_KEY: 'email-test', RESEND_FROM: 'N3 <study@example.com>', APP_URL: 'https://study.example.com/' }
const response = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const job = { id: 'job-one', attempts: 1, recipient: 'confirmed@example.com', unsubscribe_token: token }
const request = (path = '', options = {}) => new Request(`https://project.supabase.co/functions/v1/study-reminders${path}`, { method: 'POST', headers: { Authorization: `Bearer ${secret}` }, ...options })
function fixture({ overrides = {}, dispatch = () => null } = {}) {
  const calls = []
  const handler = createReminderHandler({ env: key => ({ ...values, ...overrides })[key] || '', pause: async () => {}, fetchImpl: async (url, options) => {
    const call = { name: url.split('/').at(-1), url, body: JSON.parse(options.body), headers: options.headers }
    calls.push(call)
    return await dispatch(call, calls) || response(null)
  } })
  return { handler, calls }
}

test('reminders default to off and validate per-day times and unique weekdays', () => {
  assert.equal(DEFAULT_REMINDER.enabled, false)
  assert.equal(validateReminder(DEFAULT_REMINDER), '')
  for (const invalid of [{ local_time: '24:00' }, { local_time: '8:15' }, { day_times: ['20:00', 'bad', ...Array(5).fill('20:00')] }, { day_times: ['20:00'] }, { weekdays: [] }, { weekdays: [1, 1] }, { weekdays: [7] }, { weekdays: [1.5] }, { enabled: 'true' }]) {
    assert.ok(validateReminder({ ...DEFAULT_REMINDER, ...invalid }))
  }
  assert.equal(validateReminder({ ...DEFAULT_REMINDER, weekdays: [1, 3, 5], day_times: ['19:00', '18:00', '20:00', '21:00', '20:00', '20:00', '20:00'] }), '')
})

test('cron rejects public keys, absent credentials and short configured secrets before database access', async () => {
  for (const authorization of ['', 'Bearer sb_publishable_public', 'Bearer wrong']) {
    const { handler, calls } = fixture()
    assert.equal((await handler(request('', { headers: { Authorization: authorization } }))).status, 401)
    assert.equal(calls.length, 0)
  }
  const { handler, calls } = fixture({ overrides: { REMINDER_CRON_SECRET: 'short' } })
  assert.equal((await handler(request('', { headers: { Authorization: 'Bearer short' } }))).status, 401)
  assert.equal(calls.length, 0)
})

test('missing email service or non-HTTPS website never claims or sends reminders', async () => {
  for (const overrides of [{ RESEND_API_KEY: '' }, { APP_URL: 'http://study.example.com' }, { APP_URL: 'https://user:pass@study.example.com' }]) {
    const { handler, calls } = fixture({ overrides })
    assert.equal((await handler(request())).status, 503)
    assert.equal(calls.length, 0)
  }
})

test('GET unsubscribe shows confirmation without changing preferences; POST opts out without cron credentials', async () => {
  const { handler, calls } = fixture({ overrides: { REMINDER_CRON_SECRET: '', RESEND_API_KEY: '' } })
  const path = `/unsubscribe?token=${token}`
  const get = await handler(request(path, { method: 'GET', headers: {} }))
  assert.equal(get.status, 200)
  assert.match(await get.text(), /form method="post"/)
  assert.equal(calls.length, 0)
  assert.match(get.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/)
  const post = await handler(request(path, { headers: {} }))
  assert.equal(post.status, 200)
  assert.deepEqual(calls.map(call => [call.name, call.body]), [['n3vjit_unsubscribe_reminder', { p_token: token }]])
})

test('invalid unsubscribe tokens and unsupported methods never touch database', async () => {
  const { handler, calls } = fixture()
  assert.equal((await handler(request('/unsubscribe?token=invalid'))).status, 400)
  assert.equal((await handler(request(`/unsubscribe?token=${token}`, { method: 'DELETE' }))).status, 405)
  assert.equal((await handler(request('', { method: 'GET' }))).status, 405)
  assert.equal((await handler(request('/unknown'))).status, 404)
  assert.equal(calls.length, 0)
})

test('no due job means no provider call', async () => {
  const { handler, calls } = fixture()
  assert.deepEqual(await (await handler(request())).json(), { accepted: 0, failed: 0, cancelled: 0 })
  assert.equal(calls.length, 1)
})

test('revoked consent cancels the job before provider access', async () => {
  let claims = 0
  const { handler, calls } = fixture({ dispatch: call => response(call.name === 'n3vjit_claim_reminder' && claims++ === 0 ? job : null) })
  assert.deepEqual(await (await handler(request())).json(), { accepted: 0, failed: 0, cancelled: 1 })
  assert.ok(!calls.some(call => call.name === 'emails'))
})

test('sending uses confirmed recipient from the server, immutable payload and stable idempotency key', async () => {
  let claims = 0
  const persisted = { to: ['confirmed@example.com'], from: 'original@example.com', subject: 'Original payload' }
  const { handler, calls } = fixture({ dispatch: call => {
    if (call.name === 'n3vjit_claim_reminder') return response(claims++ === 0 ? job : null)
    if (call.name === 'n3vjit_prepare_reminder') return response(persisted)
    if (call.name === 'emails') return response({ id: 'provider-id' })
  } })
  const result = await handler(request('', { body: JSON.stringify({ to: 'attacker@example.com' }) }))
  assert.deepEqual(await result.json(), { accepted: 1, failed: 0, cancelled: 0 })
  const email = calls.find(call => call.name === 'emails')
  assert.deepEqual(email.body, persisted)
  assert.equal(email.headers['Idempotency-Key'], 'n3vjit-reminder/job-one')
  const prepare = calls.find(call => call.name === 'n3vjit_prepare_reminder').body
  assert.deepEqual(prepare.p_payload.to, [job.recipient])
  assert.match(prepare.p_payload.headers['List-Unsubscribe'], /\/unsubscribe\?token=/)
  assert.deepEqual(calls.find(call => call.name === 'n3vjit_finish_reminder').body, { p_id: job.id, p_attempt: 1, p_provider_id: 'provider-id' })
})

test('provider timeout, rejection and malformed success remain retryable and expose no secrets', async () => {
  for (const mode of ['timeout', 'reject', 'malformed']) {
    let claims = 0
    const { handler, calls } = fixture({ dispatch: call => {
      if (call.name === 'n3vjit_claim_reminder') return response(claims++ === 0 ? job : null)
      if (call.name === 'n3vjit_prepare_reminder') return response(call.body.p_payload)
      if (call.name === 'emails') {
        if (mode === 'timeout') throw new Error('contains-private-provider-data')
        return response(mode === 'reject' ? { error: 'contains-private-provider-data' } : {}, mode === 'reject' ? 429 : 200)
      }
    } })
    const result = await handler(request())
    assert.deepEqual(await result.json(), { accepted: 0, failed: 1, cancelled: 0 })
    assert.equal(calls.find(call => call.name === 'n3vjit_finish_reminder').body.p_provider_id, null)
  }
})

test('ambiguous send retries keep the same provider key and payload', async () => {
  let claims = 0
  let stored
  let sends = 0
  const { handler, calls } = fixture({ dispatch: call => {
    if (call.name === 'n3vjit_claim_reminder') return response(claims++ % 2 === 0 ? { ...job, attempts: Math.ceil(claims / 2) } : null)
    if (call.name === 'n3vjit_prepare_reminder') { stored ||= call.body.p_payload; return response(stored) }
    if (call.name === 'emails') { if (++sends === 1) throw new Error('timeout'); return response({ id: 'same-provider-id' }) }
  } })
  await handler(request()); await handler(request())
  const emails = calls.filter(call => call.name === 'emails')
  assert.equal(emails.length, 2)
  assert.deepEqual(emails[0].body, emails[1].body)
  assert.equal(emails[0].headers['Idempotency-Key'], emails[1].headers['Idempotency-Key'])
})

test('database failure returns a generic error and prevents sending', async () => {
  const { handler, calls } = fixture({ dispatch: () => response({ secret: 'private' }, 500) })
  const result = await handler(request())
  assert.equal(result.status, 503)
  assert.deepEqual(await result.json(), { error: 'reminder_request_failed' })
  assert.equal(calls.length, 1)
})

test('authenticated reminder settings only send schedule fields, never arbitrary recipients or keys', async () => {
  const calls = []
  const client = createAuthClient({ url: values.SUPABASE_URL, publicKey: 'sb_publishable_test', fetchImpl: async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) })
    return response(url.includes('/auth/') ? { access_token: 'access', refresh_token: 'refresh', expires_in: 3600, user: { id: 'user-a' } } : { ready: false, settings: DEFAULT_REMINDER })
  } })
  await assert.rejects(client.loadStudyReminder(), { code: 'session_not_found' })
  await client.signIn('learner@example.com', 'password')
  await client.loadStudyReminder()
  await client.saveStudyReminder({ ...DEFAULT_REMINDER, timezone: 'Asia/Tokyo', recipient: 'other@example.com', api_key: 'nope' })
  assert.ok(calls[1].url.endsWith('/rpc/n3vjit_get_reminder'))
  assert.deepEqual(calls[2].body, { p_enabled: false, p_local_time: '20:00', p_timezone: 'Asia/Ho_Chi_Minh', p_weekdays: DEFAULT_REMINDER.weekdays, p_day_times: DEFAULT_REMINDER.day_times })
})

test('push test requires a valid Supabase session and sends to saved subscriptions', async () => {
  const calls = []
  const subscription = { id: 'sub-1', endpoint: 'https://push.example/endpoint', p256dh: 'key', auth: 'auth' }
  const pushValues = { ...values, VAPID_SUBJECT: 'mailto:study@example.com', VAPID_PUBLIC_KEY: 'public-test-key', VAPID_PRIVATE_KEY: 'private-test-key' }
  const handler = createReminderHandler({ env: key => pushValues[key] || '', pushSender: async (item, message) => {
    assert.deepEqual(item, subscription)
    assert.equal(message.tag, 'n3vjit-push-test')
    return response({}, 201)
  }, fetchImpl: async (url, options) => {
    if (url.endsWith('/auth/v1/user')) return response({ id: 'user-1' })
    const body = JSON.parse(options.body); calls.push(body)
    return response([subscription])
  } })
  const result = await handler(new Request('https://project.supabase.co/functions/v1/study-reminders/test-push', {
    method: 'POST', headers: { Authorization: 'Bearer user-access-token', Origin: 'https://study.example.com' },
  }))
  assert.equal(result.status, 200)
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), 'https://study.example.com')
  assert.deepEqual(await result.json(), { accepted: 1, failed: 0, expired: 0, failure_statuses: [] })
  assert.deepEqual(calls, [{ p_user_id: 'user-1' }])
})

test('push test reports the shared one-minute rate limit', async () => {
  const pushValues = { ...values, VAPID_SUBJECT: 'mailto:study@example.com', VAPID_PUBLIC_KEY: 'public-test-key', VAPID_PRIVATE_KEY: 'private-test-key' }
  const handler = createReminderHandler({ env: key => pushValues[key] || '', fetchImpl: async url =>
    url.endsWith('/auth/v1/user') ? response({ id: 'user-1' }) : response({ rate_limited: true, retry_after: 37 }),
  })
  const result = await handler(new Request('https://project.supabase.co/functions/v1/study-reminders/test-push', {
    method: 'POST', headers: { Authorization: 'Bearer user-access-token', Origin: 'https://study.example.com' },
  }))
  assert.equal(result.status, 429)
  assert.deepEqual(await result.json(), { error: 'rate_limited', retry_after: 37 })
})

test('CORS only allows the configured website origin', async () => {
  const handler = createReminderHandler({ env: key => values[key] || '' })
  const allowed = await handler(new Request('https://project.supabase.co/functions/v1/study-reminders/test-push', {
    method: 'OPTIONS', headers: { Origin: 'https://study.example.com' },
  }))
  assert.equal(allowed.status, 204)
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://study.example.com')
  assert.equal(allowed.headers.get('Vary'), 'Origin')
  const rejected = await handler(new Request('https://project.supabase.co/functions/v1/study-reminders/test-push', {
    method: 'OPTIONS', headers: { Origin: 'https://attacker.example' },
  }))
  assert.equal(rejected.status, 403)
  assert.equal(rejected.headers.get('Access-Control-Allow-Origin'), null)
  assert.equal(rejected.headers.get('Vary'), 'Origin')
  const missingOrigin = await handler(new Request('https://project.supabase.co/functions/v1/study-reminders/test-push', { method: 'OPTIONS' }))
  assert.equal(missingOrigin.status, 403)
  assert.equal(missingOrigin.headers.get('Access-Control-Allow-Origin'), null)
  assert.equal(missingOrigin.headers.get('Vary'), 'Origin')
})

test('push test without a JWT returns 401 with allowed-origin CORS headers', async () => {
  let authCalls = 0
  const handler = createReminderHandler({ env: key => values[key] || '', fetchImpl: async () => { authCalls++; return response({ id: 'unexpected' }) } })
  const result = await handler(new Request('https://project.supabase.co/functions/v1/study-reminders/test-push', {
    method: 'POST', headers: { Origin: 'https://study.example.com' },
  }))
  assert.equal(result.status, 401)
  assert.deepEqual(await result.json(), { error: 'unauthorized' })
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), 'https://study.example.com')
  assert.equal(result.headers.get('Vary'), 'Origin')
  assert.equal(authCalls, 0)
})

test('cron responses do not include CORS headers', async () => {
  const { handler } = fixture()
  const result = await handler(request('', { headers: { Authorization: 'Bearer wrong', Origin: 'https://study.example.com' } }))
  assert.equal(result.status, 401)
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), null)
  assert.equal(result.headers.get('Vary'), null)
})

test('push test reports invalid VAPID subject before claiming rate limit', async () => {
  const calls = []
  const handler = createReminderHandler({
    env: key => ({ ...values, VAPID_SUBJECT: 'not-a-contact-uri', VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' })[key] || '',
    fetchImpl: async url => {
      if (url.endsWith('/auth/v1/user')) return response({ id: 'user-1' })
      calls.push(url)
      return response([])
    },
  })
  const result = await handler(new Request('https://project.supabase.co/functions/v1/study-reminders/test-push', {
    method: 'POST', headers: { Authorization: 'Bearer user-access-token', Origin: 'https://study.example.com' },
  }))
  assert.equal(result.status, 503)
  assert.deepEqual(await result.json(), { error: 'invalid_vapid_subject' })
  assert.deepEqual(calls, [])
})
