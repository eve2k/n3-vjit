import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAuthClient } from '../services/authClient.js'
import { createProgressSync } from '../services/progressSync.js'
import { reconcileProgress, sameProgress } from './syncProgress.js'

const clone = value => JSON.parse(JSON.stringify(value))
const cards = values => ({ n3vjit_masteredFlashcards: values })
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function fixture({ initial = {}, baseline = null, remote = null, load, save } = {}) {
  let local = clone(initial)
  let base = baseline && clone(baseline)
  let cloud = remote && clone(remote)
  let writes = 0
  const states = []
  const timers = new Map()
  let nextTimer = 0
  const saves = []
  const sync = createProgressSync({
    client: {
      loadProgress: load || (async () => cloud && clone(cloud)),
      saveProgress: async (data, stamp) => {
        saves.push({ data: clone(data), stamp })
        if (save) return save(data, stamp)
        cloud = { data: clone(data), updated_at: `version-${saves.length}` }
        return clone(cloud)
      },
    },
    readLocal: () => clone(local), writeLocal: data => { local = clone(data); writes++ },
    loadBase: () => base && clone(base), saveBase: data => { base = clone(data) },
    onState: state => states.push(clone(state)),
    schedule: (task, delay) => { const id = ++nextTimer; timers.set(id, { task, delay }); return id },
    cancel: id => timers.delete(id),
  })
  return { sync, states, saves, timers, local: () => local, base: () => base, writes: () => writes, edit: data => { local = clone(data); sync.changed() } }
}

test('first login downloads cloud progress; an empty new device never overwrites it', async () => {
  const f = fixture({ remote: { data: cards(['a']), updated_at: 'cloud-one' } })
  await f.sync.syncNow()
  assert.deepEqual(f.local(), cards(['a']))
  assert.deepEqual(f.base(), cards(['a']))
  assert.equal(f.saves.length, 0)
  assert.equal(f.states.at(-1).status, 'synced')
})

test('initial device upload is automatic and only acknowledges a successful save', async () => {
  const f = fixture({ initial: cards(['a']) })
  await f.sync.syncNow()
  assert.deepEqual(f.saves, [{ data: cards(['a']), stamp: null }])
  assert.deepEqual(f.base(), cards(['a']))
  assert.equal(f.states.at(-1).ready, true)
})

test('empty account does not create unnecessary cloud rows', async () => {
  const f = fixture()
  await f.sync.syncNow()
  assert.equal(f.saves.length, 0)
  assert.deepEqual(f.base(), {})
})

test('unsent edits merge with other device updates; removed cards stay removed', async () => {
  const f = fixture({ baseline: cards(['a', 'b']), initial: cards(['b', 'local']), remote: { data: cards(['a', 'b', 'remote']), updated_at: 'other-device' } })
  await f.sync.syncNow()
  assert.deepEqual(new Set(f.local().n3vjit_masteredFlashcards), new Set(['b', 'local', 'remote']))
  assert.equal(f.saves[0].stamp, 'other-device')
})

test('an unchanged old device adopts remote deletion and reset', async () => {
  const original = cards(['a', 'b'])
  const f = fixture({ baseline: original, initial: original, remote: { data: {}, updated_at: 'reset' } })
  await f.sync.syncNow()
  assert.deepEqual(f.local(), {})
  assert.equal(f.saves.length, 0)
})

test('explicit local reset propagates to cloud rather than merging deleted data back in', async () => {
  const f = fixture({ baseline: cards(['a']), initial: {}, remote: { data: cards(['a']), updated_at: 'old' } })
  await f.sync.syncNow()
  assert.deepEqual(f.saves[0].data, {})
})

test('cloud response arriving while the user studies preserves those new edits', async () => {
  const pending = defer()
  const f = fixture({ baseline: cards(['a']), initial: cards(['a']), load: () => pending.promise })
  const task = f.sync.syncNow()
  f.edit(cards(['a', 'new-answer']))
  pending.resolve({ data: cards(['a', 'remote']), updated_at: 'cloud' })
  await task
  assert.deepEqual(new Set(f.saves[0].data.n3vjit_masteredFlashcards), new Set(['a', 'new-answer', 'remote']))
})

test('edits made during save stay local and queue another automatic sync', async () => {
  const pending = defer()
  const f = fixture({ initial: cards(['a']), save: () => pending.promise })
  const task = f.sync.syncNow()
  await new Promise(resolve => setImmediate(resolve))
  f.edit(cards(['a', 'b']))
  pending.resolve({ updated_at: 'saved-a' })
  await task
  assert.deepEqual(f.local(), cards(['a', 'b']))
  assert.deepEqual(f.base(), cards(['a']))
  assert.equal(f.states.at(-1).status, 'pending')
  assert.ok([...f.timers.values()].some(timer => timer.delay === 0))
})

test('optimistic update conflict rebases and retries without discarding either device', async () => {
  let calls = 0
  let saves = 0
  const f = fixture({ initial: cards(['local']), baseline: cards([]), load: async () => ({ data: cards(calls++ ? ['remote'] : []), updated_at: `v${calls}` }), save: async () => {
    if (++saves === 1) throw Object.assign(new Error('conflict'), { status: 409 })
    return { updated_at: 'saved' }
  } })
  await f.sync.syncNow()
  assert.equal(f.saves.length, 2)
  assert.deepEqual(new Set(f.saves[1].data.n3vjit_masteredFlashcards), new Set(['local', 'remote']))
})

test('offline failure retains local progress and baseline then schedules retry', async () => {
  const f = fixture({ initial: cards(['pending']), baseline: cards([]), load: async () => { throw Object.assign(new Error('offline'), { code: 'network_error' }) } })
  await f.sync.syncNow()
  assert.deepEqual(f.local(), cards(['pending']))
  assert.deepEqual(f.base(), cards([]))
  assert.equal(f.states.at(-1).status, 'offline')
  assert.equal(f.states.at(-1).ready, true)
  assert.ok([...f.timers.values()].some(timer => timer.delay === 5000))
})

test('logout/account switch stops in-flight hydration and future retries', async () => {
  const pending = defer()
  const f = fixture({ load: () => pending.promise })
  const task = f.sync.syncNow()
  f.sync.stop()
  pending.resolve({ data: cards(['private-other-account']), updated_at: 'v' })
  await task
  assert.equal(f.writes(), 0)
  assert.equal(f.saves.length, 0)
  assert.equal(f.timers.size, 0)
})

test('concurrent sync requests are serialized', async () => {
  const pending = defer()
  let loads = 0
  const f = fixture({ load: () => { loads++; return pending.promise } })
  const first = f.sync.syncNow()
  const second = f.sync.syncNow()
  pending.resolve(null)
  await Promise.all([first, second])
  assert.equal(loads, 1)
})

test('three-way merge keeps independent profile edits and picks a whole newer essay', () => {
  const base = { n3vjit_userProfile: { name: 'A', major: 'IT' }, n3vjit_customSakubun: { essay: { text: 'base', updatedAt: '2026-10-01' } } }
  const local = { n3vjit_userProfile: { name: 'B', major: 'IT' }, n3vjit_customSakubun: { essay: { text: 'local', updatedAt: '2026-10-02' } } }
  const remote = { n3vjit_userProfile: { name: 'A', major: 'Japanese' }, n3vjit_customSakubun: { essay: { text: 'remote', updatedAt: '2026-10-03' } } }
  const result = reconcileProgress(base, local, remote)
  assert.deepEqual({ ...result.n3vjit_userProfile }, { name: 'B', major: 'Japanese' })
  assert.deepEqual(result.n3vjit_customSakubun.essay, remote.n3vjit_customSakubun.essay)
})

test('history merges attempts by identity while respecting removal', () => {
  const a = { id: 'a', date: '2026-10-01' }
  const b = { id: 'b', date: '2026-10-02' }
  const c = { id: 'c', date: '2026-10-03' }
  const result = reconcileProgress({ n3vjit_quizHistory: [a] }, { n3vjit_quizHistory: [a, b] }, { n3vjit_quizHistory: [a, c] })
  assert.deepEqual(result.n3vjit_quizHistory, [a, b, c])
  const removed = reconcileProgress({ n3vjit_quizHistory: [a] }, { n3vjit_quizHistory: [] }, { n3vjit_quizHistory: [a, c] })
  assert.deepEqual(removed.n3vjit_quizHistory, [c])
})

test('semantic snapshot equality does not depend on JSON object key ordering', () => {
  assert.equal(sameProgress({ b: 1, a: [2] }, { a: [2], b: 1 }), true)
  assert.equal(sameProgress({ a: [2] }, { a: [3] }), false)
})

const memoryStorage = () => { const map = new Map(); return { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key), map } }
const reply = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })

test('Google redirect uses PKCE, preflights provider readiness and stores only a verifier in session storage', async () => {
  const oauthStorage = memoryStorage()
  const client = createAuthClient({ url: 'https://project.supabase.co', publicKey: 'sb_publishable_test', oauthStorage, fetchImpl: async () => reply({ external: { google: true } }) })
  const url = new URL(await client.getGoogleSignInUrl('http://localhost:5173/auth/callback'))
  assert.equal(url.origin, 'https://project.supabase.co')
  assert.equal(url.pathname, '/auth/v1/authorize')
  assert.equal(url.searchParams.get('provider'), 'google')
  assert.equal(url.searchParams.get('code_challenge_method'), 's256')
  assert.equal(url.searchParams.get('prompt'), 'select_account')
  const pending = JSON.parse([...oauthStorage.map.values()][0])
  assert.ok(pending.verifier.length >= 43)
  assert.ok(!url.href.includes(pending.verifier))
  const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pending.verifier))).toString('base64url')
  assert.equal(url.searchParams.get('code_challenge'), challenge)
})

test('Google provider configuration, redirect safety and blocked storage fail before navigation', async () => {
  const client = createAuthClient({ url: 'https://project.supabase.co', publicKey: 'sb_publishable_test', fetchImpl: async () => reply({ external: { google: false } }) })
  await assert.rejects(client.getGoogleSignInUrl('https://app.example/auth/callback'), { code: 'google_not_configured' })
  await assert.rejects(client.getGoogleSignInUrl('javascript:alert(1)'), { code: 'invalid_redirect' })
  await assert.rejects(client.getGoogleSignInUrl('http://app.example/auth/callback'), { code: 'invalid_redirect' })
  const blocked = createAuthClient({ url: 'https://project.supabase.co', publicKey: 'sb_publishable_test', fetchImpl: async () => reply({ external: { google: true } }) })
  await assert.rejects(blocked.getGoogleSignInUrl('https://app.example/auth/callback'), { code: 'oauth_storage_unavailable' })
})

test('Google callback requires its initiating verifier, exchanges the code and never persists Google provider tokens', async () => {
  const storage = memoryStorage()
  const oauthStorage = memoryStorage()
  const calls = []
  const client = createAuthClient({ url: 'https://project.supabase.co', publicKey: 'sb_publishable_test', storage, oauthStorage, fetchImpl: async (url, options) => {
    calls.push({ url, body: options.body && JSON.parse(options.body) })
    return reply(url.endsWith('/settings') ? { external: { google: true } } : { access_token: 'app-access', refresh_token: 'app-refresh', expires_in: 3600, provider_token: 'google-secret-not-saved', user: { id: 'google-user' } })
  } })
  await assert.rejects(client.acceptCallback('', '?code=uninitiated'), { code: 'oauth_verifier_missing' })
  await client.getGoogleSignInUrl('https://app.example/auth/callback')
  assert.deepEqual(await client.acceptCallback('', '?code=one-time-code'), { recovery: false })
  assert.ok(calls[1].url.endsWith('/token?grant_type=pkce'))
  assert.equal(calls[1].body.auth_code, 'one-time-code')
  assert.ok(calls[1].body.code_verifier)
  assert.equal(oauthStorage.map.size, 0)
  assert.ok(![...storage.map.values()].join('').includes('google-secret-not-saved'))
  await assert.rejects(client.loadProgress('different-user'), { code: 'session_not_found' })
  await assert.rejects(client.saveProgress({}, null, 'different-user'), { code: 'session_not_found' })
  assert.equal(calls.length, 2)
})

test('expired and cancelled Google callbacks cannot create a session', async () => {
  const oauthStorage = memoryStorage()
  let clock = 0
  const client = createAuthClient({ url: 'https://project.supabase.co', publicKey: 'sb_publishable_test', oauthStorage, now: () => clock, fetchImpl: async () => reply({ external: { google: true } }) })
  await client.getGoogleSignInUrl('https://app.example/auth/callback')
  clock = 600001
  await assert.rejects(client.acceptCallback('', '?code=expired'), { code: 'oauth_verifier_missing' })
  await assert.rejects(client.acceptCallback('', '?error=access_denied'), { code: 'access_denied' })
  assert.equal(oauthStorage.map.size, 0)
})

test('reopening offline restores the known local account workspace while preserving server validation requirements', async () => {
  const storage = memoryStorage()
  const client = createAuthClient({ url: 'https://project.supabase.co', publicKey: 'sb_publishable_test', storage, fetchImpl: async () => { throw new Error('offline') } })
  storage.setItem(client.storageKey, JSON.stringify({ access_token: 'cached-access', refresh_token: 'cached-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'known-user' } }))
  let restoredUser
  client.subscribe(session => { restoredUser = session?.user.id })
  await assert.rejects(client.restoreSession(), { code: 'network_error' })
  assert.equal(restoredUser, 'known-user')
  await assert.rejects(client.loadProgress('different-account'), { code: 'session_not_found' })
  assert.ok(storage.getItem(client.storageKey))
})
