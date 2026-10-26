// No browser code imports this module. All credentials stay in Edge Function secrets.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
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

export function createReminderHandler({ env, fetchImpl = globalThis.fetch, now = () => Date.now(), pause = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  async function rpc(name, body = {}) {
    const response = await fetchImpl(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error('database_request_failed')
    return response.status === 204 ? null : response.json()
  }

  return async request => {
    try {
      const url = new URL(request.url)
      const unsubscribe = url.pathname.endsWith('/unsubscribe')
      if (unsubscribe) {
        const token = url.searchParams.get('token') || ''
        if (!uuid.test(token)) return json({ error: 'invalid_link' }, 400)
        if (request.method === 'GET') {
          // GET never disables reminders: email scanners may visit links automatically.
          return html('<h1>Tắt email nhắc học?</h1><p>Bạn có thể bật lại trong trang Tài khoản.</p><form method="post"><button type="submit">Tắt nhắc học qua email</button></form>')
        }
        if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
        if (!env('SUPABASE_URL') || !env('SUPABASE_SERVICE_ROLE_KEY')) return json({ error: 'not_configured' }, 503)
        await rpc('n3vjit_unsubscribe_reminder', { p_token: token })
        return html('<h1>Đã tắt email nhắc học</h1><p>Bạn có thể bật lại trong trang Tài khoản của website N3.</p>')
      }
      if (!url.pathname.endsWith('/study-reminders')) return json({ error: 'not_found' }, 404)
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
      if (!await sameSecret(request.headers.get('authorization') || '', `Bearer ${env('REMINDER_CRON_SECRET')}`) || env('REMINDER_CRON_SECRET').length < 32) return json({ error: 'unauthorized' }, 401)
      if (!['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'RESEND_FROM', 'APP_URL'].every(key => env(key))) return json({ error: 'not_configured' }, 503)
      const app = new URL(env('APP_URL'))
      const backend = new URL(env('SUPABASE_URL'))
      if (app.protocol !== 'https:' || backend.protocol !== 'https:' || app.username || app.password || app.search || app.hash) return json({ error: 'invalid_configuration' }, 503)
      const started = now()
      const counts = { accepted: 0, failed: 0, cancelled: 0 }
      // Claims individually so an invocation never abandons a large leased batch.
      for (let i = 0; i < 20 && now() - started < 40000; i++) {
        const job = await rpc('n3vjit_claim_reminder')
        if (!job) break
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
      return json(counts)
    } catch { return json({ error: 'reminder_request_failed' }, 503) }
  }
}
