// No browser code imports this module. All credentials stay in Edge Function secrets.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const corsHeaders = origin => ({
  Vary: 'Origin',
  ...(origin ? {
    'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '86400',
  } : {}),
})
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers,
} })
const html = body => new Response(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nhắc học N3</title><body><main>${body}</main></body></html>`, { headers: {
  'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff',
} })

async function sameSecret(actual, expected) {
  if (!expected || expected.length < 32) return false
  const digest = async text => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  const [a, b] = await Promise.all([digest(actual), digest(expected)])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

function isValidVapidSubject(subject) {
  if (typeof subject !== 'string' || !subject || subject.trim() !== subject || /[\r\n\s]/.test(subject)) return false
  if (/^mailto:/i.test(subject)) return /^mailto:[^@\s]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(subject)
  try {
    const url = new URL(subject)
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
  } catch { return false }
}

function getVapidConfig(env) {
  const subject = env('VAPID_SUBJECT')
  const publicKey = env('VAPID_PUBLIC_KEY')
  const privateKey = env('VAPID_PRIVATE_KEY')
  const present = [subject, publicKey, privateKey].filter(Boolean).length
  if (!present) return { configured: false, error: 'push_not_configured' }
  if (!subject || !publicKey || !privateKey) return { configured: false, error: 'push_configuration_incomplete' }
  if (!isValidVapidSubject(subject)) return { configured: false, error: 'invalid_vapid_subject' }
  return { configured: true, subject, publicKey, privateKey }
}

function matchingOrigin(request, appUrl) {
  const origin = request.headers.get('origin')
  if (!origin || !appUrl) return null
  try { return new URL(appUrl).origin === origin ? origin : null }
  catch { return null }
}

export function createReminderHandler({ env, fetchImpl = globalThis.fetch, now = () => Date.now(), pause = ms => new Promise(resolve => setTimeout(resolve, ms)), pushSender = null }) {
  async function rpc(name, body = {}) {
    const response = await fetchImpl(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error('database_request_failed')
    return response.status === 204 ? null : response.json()
  }

  return async request => {
    // Handle preflight before parsing routes or checking any credentials.
    if (request.method === 'OPTIONS') {
      const origin = matchingOrigin(request, env('APP_URL'))
      return new Response(null, { status: origin ? 204 : 403, headers: corsHeaders(origin) })
    }
    let isTestPush = false
    try {
      const url = new URL(request.url)
      isTestPush = url.pathname.endsWith('/test-push')
      const respond = (data, status = 200) => json(data, status)
      const respondTestPush = (data, status = 200) => json(data, status, corsHeaders(matchingOrigin(request, env('APP_URL'))))
      const unsubscribe = url.pathname.endsWith('/unsubscribe')
      if (unsubscribe) {
        const token = url.searchParams.get('token') || ''
        if (!uuid.test(token)) return respond({ error: 'invalid_link' }, 400)
        if (request.method === 'GET') {
          // GET never disables reminders: email scanners may visit links automatically.
          return html('<h1>Tắt email nhắc học?</h1><p>Bạn có thể bật lại trong trang Tài khoản.</p><form method="post"><button type="submit">Tắt nhắc học qua email</button></form>')
        }
        if (request.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405)
        if (!env('SUPABASE_URL') || !env('SUPABASE_SERVICE_ROLE_KEY')) return respond({ error: 'not_configured' }, 503)
        await rpc('n3vjit_unsubscribe_reminder', { p_token: token })
        return html('<h1>Đã tắt email nhắc học</h1><p>Bạn có thể bật lại trong trang Tài khoản của website N3.</p>')
      }
      if (isTestPush) {
        if (request.method !== 'POST') return respondTestPush({ error: 'method_not_allowed' }, 405)
        if (!env('SUPABASE_URL') || !env('SUPABASE_SERVICE_ROLE_KEY')) return respondTestPush({ error: 'not_configured' }, 503)
        const authorization = request.headers.get('authorization') || ''
        if (!/^Bearer\s+\S+$/i.test(authorization)) return respondTestPush({ error: 'unauthorized' }, 401)
        const identity = await fetchImpl(`${env('SUPABASE_URL')}/auth/v1/user`, {
          headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: authorization }, signal: AbortSignal.timeout(8000),
        })
        if (!identity.ok) return respondTestPush({ error: 'unauthorized' }, 401)
        const vapid = getVapidConfig(env)
        if (!vapid.configured) return respondTestPush({ error: vapid.error }, 503)
        const user = await identity.json()
        const subscriptions = await rpc('n3vjit_claim_push_test', { p_user_id: user.id })
        if (subscriptions?.rate_limited) return respondTestPush({ error: 'rate_limited', retry_after: subscriptions.retry_after }, 429)
        const result = await sendToSubscriptions(subscriptions || [], { title: 'Thông báo thử · C2J Study', body: 'Thiết bị này đã nhận yêu cầu kiểm tra nhắc học.', tag: 'n3vjit-push-test', url: '/?from=push' })
        return respondTestPush(result)
      }
      if (!url.pathname.endsWith('/study-reminders')) return respond({ error: 'not_found' }, 404)
      if (request.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405)
      if (!await sameSecret(request.headers.get('authorization') || '', `Bearer ${env('REMINDER_CRON_SECRET')}`) || env('REMINDER_CRON_SECRET').length < 32) return respond({ error: 'unauthorized' }, 401)
      if (!['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'APP_URL'].every(key => env(key))) return respond({ error: 'not_configured' }, 503)
      const emailConfigured = Boolean(env('RESEND_API_KEY') && env('RESEND_FROM'))
      const vapid = getVapidConfig(env)
      if (!emailConfigured && !vapid.configured) return respond({ error: vapid.error }, 503)
      const app = new URL(env('APP_URL'))
      const backend = new URL(env('SUPABASE_URL'))
      if (app.protocol !== 'https:' || backend.protocol !== 'https:' || app.username || app.password || app.search || app.hash) return respond({ error: 'invalid_configuration' }, 503)
      const started = now()
      const counts = { accepted: 0, failed: 0, cancelled: 0 }
      if (!vapid.configured && emailConfigured && vapid.error !== 'push_not_configured') counts.push_error = vapid.error
      // Claims individually so an invocation never abandons a large leased batch.
      for (let i = 0; i < 20 && now() - started < 40000; i++) {
        const job = await rpc('n3vjit_claim_reminder')
        if (!job) break
        if (!env('RESEND_API_KEY') || !env('RESEND_FROM')) {
          await rpc('n3vjit_finish_reminder', { p_id: job.id, p_attempt: job.attempts, p_provider_id: null })
          counts.failed++
          continue
        }
        const unsubscribeUrl = `${backend.origin}/functions/v1/study-reminders/unsubscribe?token=${encodeURIComponent(job.unsubscribe_token)}`
        const proposed = {
          from: env('RESEND_FROM'), to: [job.recipient], subject: 'Đã đến giờ học tiếng Nhật N3',
          text: `Đã đến giờ học tiếng Nhật N3 theo lịch bạn đã chọn. Dành một chút thời gian ôn tập hôm nay nhé!\nVào học: ${app.href}\nTắt nhắc học: ${unsubscribeUrl}`,
          html: `<h1>Đã đến giờ học N3</h1><p>Dành một chút thời gian ôn tập hôm nay nhé!</p><p><a href="${escapeHtml(app.href)}">Vào học tiếng Nhật</a></p><p>Bạn nhận email vì đã bật lịch nhắc học trong tài khoản.</p><p><a href="${escapeHtml(unsubscribeUrl)}">Tắt email nhắc học</a></p>`,
          headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        }
        const payload = await rpc('n3vjit_prepare_reminder', { p_id: job.id, p_attempt: job.attempts, p_payload: proposed })
        if (!payload) { counts.cancelled++; continue }
        let providerId = null
        try {
          const response = await fetchImpl('https://api.resend.com/emails', {
            method: 'POST', headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json', 'Idempotency-Key': `n3vjit-reminder/${job.id}` },
            body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
          })
          if (response.ok) {
            const result = await response.json()
            if (typeof result.id === 'string' && result.id) providerId = result.id
          }
        } catch { /* An ambiguous send is retried with the same persisted payload and idempotency key. */ }
        await rpc('n3vjit_finish_reminder', { p_id: job.id, p_attempt: job.attempts, p_provider_id: providerId })
        counts[providerId ? 'accepted' : 'failed']++
        await pause(600)
      }
      if (vapid.configured) {
        for (let i = 0; i < 100 && now() - started < 40000; i++) {
          const claimed = await rpc('n3vjit_claim_push_reminder')
          if (!claimed) break
          const prepared = await rpc('n3vjit_prepare_push', { p_id: claimed.job.id, p_attempt: claimed.job.attempts })
          if (!prepared) { counts.cancelled++; continue }
          const { job, subscription } = prepared
          const result = await sendToSubscriptions([subscription], { title: 'Đã đến giờ học tiếng Nhật N3', body: 'Dành một chút thời gian ôn tập hôm nay nhé!', tag: `n3vjit-reminder-${job.local_date}`, url: '/?from=push' })
          const status = result.accepted ? 'sent' : result.expired ? 'cancelled' : 'failed'
          await rpc('n3vjit_finish_push', { p_id: job.id, p_status: status })
          if (result.accepted) await rpc('n3vjit_mark_push_success', { p_subscription_id: subscription.id })
          counts[status === 'sent' ? 'accepted' : status === 'cancelled' ? 'cancelled' : 'failed']++
          await pause(200)
        }
      }
      return respond(counts)
    } catch {
      const headers = isTestPush ? corsHeaders(matchingOrigin(request, env('APP_URL'))) : {}
      return json({ error: isTestPush ? 'push_test_request_failed' : 'reminder_request_failed' },  isTestPush ? 500 : 503, headers)
    }
  }

  async function sendToSubscriptions(subscriptions, data) {
    const send = pushSender || (async (item, message) => {
      const { buildPushPayload } = await import('npm:@block65/webcrypto-web-push@2.0.0')
      const payload = await buildPushPayload({ data: JSON.stringify(message), options: { ttl: 3600 } }, {
        endpoint: item.endpoint, expirationTime: null, keys: { p256dh: item.p256dh, auth: item.auth },
      }, { subject: env('VAPID_SUBJECT'), publicKey: env('VAPID_PUBLIC_KEY'), privateKey: env('VAPID_PRIVATE_KEY') })
      return fetchImpl(item.endpoint, { ...payload, signal: AbortSignal.timeout(10000) })
    })
    const counts = { accepted: 0, failed: 0, expired: 0 }
    const failureStatuses = new Set()
    for (const item of subscriptions) {
      try {
        const response = await send(item, data)
        if (response.status === 404 || response.status === 410) {
          if (item.id) await rpc('n3vjit_expire_push_subscription', { p_id: item.id })
          counts.expired++
        } else if (response.status === 429 || response.status >= 500 || !response.ok) {
          counts.failed++
          failureStatuses.add(response.status)
        }
        else counts.accepted++
      } catch (error) {
        counts.failed++
        failureStatuses.add(error?.name === 'TimeoutError' ? 'timeout' : 'network_error')
      }
    }
    return { ...counts, failure_statuses: [...failureStatuses] }
  }
}
