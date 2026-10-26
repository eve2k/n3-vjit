// Supabase Auth REST API: https://github.com/supabase/auth/blob/master/openapi.yaml
// Passwords are sent only to Supabase and are never written to browser storage.
export function createAuthClient({ url = '', publicKey = '', storage, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  let baseUrl = ''
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) {
      if (!parsed.username && !parsed.password) baseUrl = parsed.origin
    }
  } catch { /* An unconfigured installation continues to support guest study. */ }
  let publicKeyAllowed = publicKey.startsWith('sb_publishable_')
  if (!publicKeyAllowed && publicKey.split('.').length === 3) {
    try { publicKeyAllowed = JSON.parse(atob(publicKey.split('.')[1].replaceAll('-', '+').replaceAll('_', '/'))).role === 'anon' } catch { /* Reject private or malformed keys. */ }
  }
  const configured = Boolean(baseUrl && publicKeyAllowed)
  const storageKey = `n3vjit_auth:${baseUrl}`
  let session = null
  let generation = 0
  let refreshPromise = null
  let restorePromise = null
  const listeners = new Set()
  const error = (code, status = 0) => Object.assign(new Error(code), { code, status })

  async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
    if (!configured) throw error('not_configured')
    let response
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method, headers: { apikey: publicKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000),
      })
    } catch { throw error('network_error') }
    const contentType = response.headers.get('content-type') || ''
    let data = null
    try { data = contentType.includes('json') ? await response.json() : null } catch { throw error('request_failed', response.status) }
    if (!response.ok) throw error(data?.error_code || data?.error || (typeof data?.code === 'string' ? data.code : null) || (response.status === 401 ? 'session_not_found' : 'request_failed'), response.status)
    if (!contentType.includes('json') && response.status !== 204) throw error('request_failed', response.status)
    return data
  }

  function updateSession(next, persist = true) {
    if (persist && storage) {
      if (next) storage.setItem(storageKey, JSON.stringify(next))
      else storage.removeItem(storageKey)
    }
    session = next
    listeners.forEach((listener) => listener(session))
  }

  function tokenSession(data, user = data?.user) {
    if (!data?.access_token || !data?.refresh_token || typeof user?.id !== 'string') throw error('session_not_found')
    return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Math.floor(now() / 1000) + (Number(data.expires_in) > 0 ? Number(data.expires_in) : 3600), user }
  }

  async function refresh() {
    if (refreshPromise) return refreshPromise
    if (!session?.refresh_token) throw error('session_not_found')
    const version = generation
    const currentRefreshToken = session.refresh_token
    refreshPromise = (async () => {
      try {
        const exchange = async () => {
          if (version !== generation) throw error('session_not_found')
          let latest
          try { latest = JSON.parse(storage?.getItem(storageKey) || 'null') } catch { /* Continue with the in-memory session. */ }
          if (latest?.user?.id === session?.user.id && latest.refresh_token !== currentRefreshToken && latest.expires_at > Math.floor(now() / 1000) + 60) {
            updateSession(latest, false)
            return session
          }
          const data = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: currentRefreshToken } })
          if (version !== generation) throw error('session_not_found')
          updateSession(tokenSession(data))
          return session
        }
        const locks = globalThis.navigator?.locks
        return locks ? await locks.request(storageKey, exchange) : await exchange()
      } catch (failure) {
        if (version === generation && failure.code !== 'network_error') updateSession(null)
        throw failure
      } finally { refreshPromise = null }
    })()
    return refreshPromise
  }

  async function validSession() {
    if (!session) throw error('session_not_found')
    return session.expires_at <= Math.floor(now() / 1000) + 60 ? refresh() : session
  }

  async function authorizedRequest(path, options = {}) {
    const version = generation
    let current = await validSession()
    const userId = current.user.id
    const checked = (data) => {
      if (version !== generation || session?.user.id !== userId) throw error('session_not_found')
      return data
    }
    try { return checked(await request(path, { ...options, token: current.access_token })) }
    catch (failure) {
      if (version !== generation || session?.user.id !== userId) throw error('session_not_found')
      if (failure.status !== 401) throw failure
      current = await refresh()
      return checked(await request(path, { ...options, token: current.access_token }))
    }
  }

  async function restoreSession() {
    if (restorePromise) return restorePromise
    restorePromise = (async () => {
      if (!configured || !storage) return null
      let version = generation
      try {
        const stored = JSON.parse(storage.getItem(storageKey) || 'null')
        if (!stored?.access_token || !stored?.refresh_token || !Number.isFinite(stored.expires_at) || typeof stored.user?.id !== 'string') { ++generation; updateSession(null, false); return null }
        if (session?.user.id !== stored.user?.id) ++generation
        version = generation
        session = stored
        const current = await validSession()
        const user = await request('/auth/v1/user', { token: current.access_token })
        if (typeof user?.id !== 'string') throw error('session_not_found')
        if (version !== generation) return session
        updateSession({ ...current, user })
        return session
      } catch (failure) {
        if (version !== generation) return session
        if (failure.code === 'network_error') throw failure
        updateSession(null)
        return null
      }
    })().finally(() => { restorePromise = null })
    return restorePromise
  }

  return {
    configured,
    storageKey,
    hasStoredSession() { try { return Boolean(storage?.getItem(storageKey)) } catch { return false } },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    restoreSession,
    syncStorage() { ++generation; restorePromise = null; return restoreSession() },
    refreshIfNeeded() { return session ? validSession() : Promise.resolve(null) },
    async signIn(email, password) {
      const version = ++generation
      const data = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email.trim(), password } })
      if (version !== generation) throw error('session_not_found')
      updateSession(tokenSession(data))
      return session.user
    },
    async signUp(name, email, password, redirectTo) {
      const version = ++generation
      const data = await request(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`, { method: 'POST', body: { email: email.trim(), password, data: { display_name: name.trim() } } })
      if (!data?.id && !data?.user?.id) throw error('request_failed')
      if (version !== generation) throw error('session_not_found')
      if (data?.access_token) updateSession(tokenSession(data))
      return { needsConfirmation: !data?.access_token }
    },
    async signOut() {
      const token = session?.access_token
      ++generation
      updateSession(null)
      if (token) {
        try { await request('/auth/v1/logout?scope=local', { method: 'POST', token }) }
        catch { /* Local sign-out still completes if the service is unreachable. */ }
      }
    },
    async sendRecovery(email, redirectTo) {
      await request(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, { method: 'POST', body: { email: email.trim() } })
    },
    async resendConfirmation(email, redirectTo) {
      await request(`/auth/v1/resend?redirect_to=${encodeURIComponent(redirectTo)}`, { method: 'POST', body: { type: 'signup', email: email.trim() } })
    },
    async setPassword(password) {
      return authorizedRequest('/auth/v1/user', { method: 'PUT', body: { password } })
    },
    async acceptCallback(hash) {
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      if (params.has('error') || params.has('error_code')) throw error(params.get('error_code') || 'otp_expired')
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (!access_token || !refresh_token) throw error('otp_expired')
      const version = ++generation
      const user = await request('/auth/v1/user', { token: access_token })
      if (version !== generation) throw error('session_not_found')
      updateSession(tokenSession({ access_token, refresh_token, expires_in: params.get('expires_in') }, user))
      return { recovery: params.get('type') === 'recovery' }
    },
    async loadProgress() {
      const current = await validSession()
      const query = new URLSearchParams({ user_id: `eq.${current.user.id}`, select: 'data,updated_at' })
      const rows = await authorizedRequest(`/rest/v1/n3vjit_study_progress?${query}`)
      return rows?.[0] || null
    },
    async saveProgress(data, updatedAt = null) {
      const current = await validSession()
      const query = new URLSearchParams({ user_id: `eq.${current.user.id}` })
      if (updatedAt) query.set('updated_at', `eq.${updatedAt}`)
      const rows = await authorizedRequest(`/rest/v1/n3vjit_study_progress${updatedAt ? `?${query}` : ''}`, {
        method: updatedAt ? 'PATCH' : 'POST',
        body: updatedAt ? { data } : { user_id: current.user.id, data },
        headers: { Prefer: 'return=representation' },
      })
      if (!Array.isArray(rows) || rows.length !== 1) throw error('progress_conflict', 409)
      return rows[0]
    },
  }
}
