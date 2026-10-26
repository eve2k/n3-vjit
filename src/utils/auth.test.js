import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { createAuthClient } from '../services/authClient.js'
import { authErrorMessage, validateAuthForm } from './authValidation.js'
import { getCompletedQuestions, getUserProfile, importProgress, markQuestionCompleted, readProgressSnapshot, resetAllProgress, setStorageUser, writeProgressSnapshot } from './storage.js'
import { mergeProgress } from './mergeProgress.js'

const user = { id: 'user-a', email: 'learner@example.com', user_metadata: { display_name: 'Learner' } }
const tokenData = (extra = {}) => ({ access_token: 'access-test', refresh_token: 'refresh-test', expires_in: 3600, user, ...extra })
const reply = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
const memoryStorage = () => {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key), data }
}
const fixture = (fetchImpl, options = {}) => {
  const storage = memoryStorage()
  return { storage, client: createAuthClient({ url: 'https://example.supabase.co', publicKey: 'sb_publishable_test', storage, fetchImpl, ...options }) }
}

beforeEach(() => { globalThis.localStorage = memoryStorage(); setStorageUser(null) })

test('registration validates name, email, password length and confirmation before requesting an account', () => {
  assert.deepEqual(Object.keys(validateAuthForm('register', { name: '', email: 'bad', password: 'short', confirmPassword: '' })).sort(), ['confirmPassword', 'email', 'name', 'password'])
  assert.deepEqual(validateAuthForm('register', { name: 'Learner', email: 'learner@example.com', password: 'long enough', confirmPassword: 'long enough' }), {})
  assert.deepEqual(validateAuthForm('forgot', { email: 'learner@example.com' }), {})
  assert.deepEqual(validateAuthForm('reset', { password: 'new password', confirmPassword: 'new password' }), {})
})

test('only public project keys and secure project URLs enable authentication', () => {
  assert.equal(fixture(async () => reply({})).client.configured, true)
  assert.equal(fixture(async () => reply({}), { publicKey: 'sb_secret_private' }).client.configured, false)
  const serviceKey = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`
  assert.equal(fixture(async () => reply({}), { publicKey: serviceKey }).client.configured, false)
  assert.equal(fixture(async () => reply({}), { url: 'http://example.com' }).client.configured, false)
  assert.equal(fixture(async () => reply({}), { url: 'https://user:password@example.com' }).client.configured, false)
})

test('login sends the password to the auth endpoint but never persists it', async () => {
  let request
  const { client, storage } = fixture(async (url, options) => { request = { url, options }; return reply(tokenData()) })
  await client.signIn(' learner@example.com ', 'private-password')
  assert.ok(request.url.endsWith('/auth/v1/token?grant_type=password'))
  assert.deepEqual(JSON.parse(request.options.body), { email: 'learner@example.com', password: 'private-password' })
  assert.equal(request.options.headers.apikey, 'sb_publishable_test')
  assert.ok(!storage.getItem(client.storageKey).includes('private-password'))
  assert.equal(JSON.parse(storage.getItem(client.storageKey)).user.id, user.id)
})

test('admin status and role management calls require the authenticated Supabase session', async () => {
  const calls = []
  const rows = [{ user_id: 'user-b', email: 'admin@example.com', is_admin: false }]
  const { client } = fixture(async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/auth/v1/token?grant_type=password')) return reply(tokenData())
    if (url.endsWith('/rpc/n3vjit_is_admin')) return reply(true)
    if (url.endsWith('/rpc/n3vjit_admin_list_users')) return reply(rows)
    if (url.endsWith('/rpc/n3vjit_admin_set_role')) return reply(true)
    return reply({ message: 'unexpected_request' }, 404)
  })
  await client.signIn(user.email, 'password')
  assert.equal(await client.checkAdmin(), true)
  assert.deepEqual(await client.listAdminUsers(), rows)
  assert.equal(await client.setAdminRole('learner@example.com', true), true)
  for (const call of calls.slice(1)) assert.equal(call.options.headers.Authorization, 'Bearer access-test')
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { p_email: 'learner@example.com', p_is_admin: true })
})

test('an unconfirmed registration does not create a signed-in session', async () => {
  const { client, storage } = fixture(async () => reply({ id: user.id, email: user.email }))
  let signedIn = false
  client.subscribe(session => { signedIn ||= Boolean(session) })
  assert.deepEqual(await client.signUp('Learner', user.email, 'private-password', 'https://app.example/auth/callback'), { needsConfirmation: true })
  assert.equal(storage.getItem(client.storageKey), null)
  assert.equal(signedIn, false)
})

test('incorrect credentials and non-JSON responses cannot produce a successful login', async () => {
  const { client, storage } = fixture(async () => reply({ error_code: 'invalid_credentials' }, 400))
  await assert.rejects(client.signIn(user.email, 'wrong'), { code: 'invalid_credentials' })
  assert.equal(storage.getItem(client.storageKey), null)
  assert.equal(authErrorMessage({ code: 'invalid_credentials' }), 'Email hoặc mật khẩu chưa đúng.')
  const broken = fixture(async () => new Response('<html>proxy error</html>', { headers: { 'content-type': 'text/html' } })).client
  await assert.rejects(broken.signIn(user.email, 'password'), { code: 'request_failed' })
})

test('email callbacks verify the access token with the server before creating a session', async () => {
  let authorization
  const { client, storage } = fixture(async (_url, options) => { authorization = options.headers.Authorization; return reply(user) })
  assert.deepEqual(await client.acceptCallback('#access_token=callback-access&refresh_token=callback-refresh&type=recovery&expires_in=3600'), { recovery: true })
  assert.equal(authorization, 'Bearer callback-access')
  assert.equal(JSON.parse(storage.getItem(client.storageKey)).user.id, user.id)
  const invalid = fixture(async () => reply({ error_code: 'bad_jwt' }, 401))
  await assert.rejects(invalid.client.acceptCallback('#access_token=invalid&refresh_token=invalid'), { code: 'bad_jwt' })
  assert.equal(invalid.storage.getItem(invalid.client.storageKey), null)
})

test('restore rejects a revoked session and removes its cached credentials', async () => {
  const { client, storage } = fixture(async () => reply({ error_code: 'bad_jwt' }, 401))
  storage.setItem(client.storageKey, JSON.stringify({ ...tokenData(), expires_at: Math.floor(Date.now() / 1000) + 3600 }))
  assert.equal(await client.restoreSession(), null)
  assert.equal(storage.getItem(client.storageKey), null)
})

test('a temporary network error preserves a cached session for a later retry', async () => {
  const { client, storage } = fixture(async () => { throw new TypeError('offline') })
  storage.setItem(client.storageKey, JSON.stringify({ ...tokenData(), expires_at: Math.floor(Date.now() / 1000) + 3600 }))
  await assert.rejects(client.restoreSession(), { code: 'network_error' })
  assert.ok(storage.getItem(client.storageKey))
})

test('logging out cancels a still-running login response', async () => {
  let finish
  const response = new Promise(resolve => { finish = resolve })
  const { client, storage } = fixture(async () => response)
  const login = client.signIn(user.email, 'password')
  await client.signOut()
  finish(reply(tokenData()))
  await assert.rejects(login, { code: 'session_not_found' })
  assert.equal(storage.getItem(client.storageKey), null)
})

test('logging out during session restoration cannot restore the previous account', async () => {
  let finish
  const response = new Promise(resolve => { finish = resolve })
  const { client, storage } = fixture(async url => url.endsWith('/auth/v1/user') ? response : reply(null, 204))
  storage.setItem(client.storageKey, JSON.stringify({ ...tokenData(), expires_at: Math.floor(Date.now() / 1000) + 3600 }))
  const restore = client.restoreSession()
  await client.signOut()
  finish(reply(user))
  assert.equal(await restore, null)
  assert.equal(storage.getItem(client.storageKey), null)
})

test('concurrent progress requests share one refresh-token exchange', async () => {
  let refreshes = 0
  const { client } = fixture(async url => {
    if (url.includes('grant_type=password')) return reply(tokenData({ expires_in: 1 }))
    if (url.includes('grant_type=refresh_token')) { refreshes++; return reply(tokenData({ access_token: 'new-access', refresh_token: 'new-refresh' })) }
    return reply([])
  })
  await client.signIn(user.email, 'password')
  await Promise.all([client.loadProgress(), client.loadProgress()])
  assert.equal(refreshes, 1)
})

test('a stale progress response is rejected if the account signs out while loading', async () => {
  let finish
  const pending = new Promise(resolve => { finish = resolve })
  const { client } = fixture(async url => url.includes('grant_type=password') ? reply(tokenData()) : url.includes('/rest/v1/') ? pending : reply(null, 204))
  await client.signIn(user.email, 'password')
  const load = client.loadProgress()
  await Promise.resolve(); await Promise.resolve()
  await client.signOut()
  finish(reply([{ data: { private: 'account-a' } }]))
  await assert.rejects(load, { code: 'session_not_found' })
})

test('progress updates use the previous timestamp and report an optimistic-lock conflict', async () => {
  let update
  const { client } = fixture(async (url, options) => {
    if (url.includes('grant_type=password')) return reply(tokenData())
    update = { url, options }
    return reply([])
  })
  await client.signIn(user.email, 'password')
  await assert.rejects(client.saveProgress({}, '2026-10-26T00:00:00Z'), { code: 'progress_conflict', status: 409 })
  assert.equal(update.options.method, 'PATCH')
  assert.equal(new URL(update.url).searchParams.get('updated_at'), 'eq.2026-10-26T00:00:00Z')
  assert.equal(update.options.headers.Authorization, 'Bearer access-test')
})

test('guest progress and different users remain isolated across account changes', () => {
  markQuestionCompleted('fukushuu1', 'f1_q1')
  setStorageUser('user-a')
  assert.deepEqual(getCompletedQuestions(), {})
  markQuestionCompleted('fukushuu1', 'f1_q2')
  setStorageUser('user-b')
  assert.deepEqual(getCompletedQuestions(), {})
  markQuestionCompleted('fukushuu1', 'f1_q3')
  setStorageUser('user-a')
  assert.deepEqual(getCompletedQuestions(), { fukushuu1: ['f1_q2'] })
  resetAllProgress()
  setStorageUser('user-b')
  assert.deepEqual(getCompletedQuestions(), { fukushuu1: ['f1_q3'] })
  setStorageUser(null)
  assert.deepEqual(getCompletedQuestions(), {})
})

test('progress snapshots contain study data only, never session tokens or another account', () => {
  localStorage.setItem('n3vjit_auth:test', '{"refresh_token":"private-refresh"}')
  markQuestionCompleted('fukushuu1', 'f1_q1')
  setStorageUser('user-a')
  markQuestionCompleted('fukushuu1', 'f1_q2')
  const snapshot = readProgressSnapshot()
  assert.deepEqual(snapshot, { n3vjit_completedQuestions: { fukushuu1: ['f1_q2'] } })
  assert.ok(!JSON.stringify(snapshot).includes('private-refresh'))
  assert.deepEqual(readProgressSnapshot(null), {})
})

test('cloud restore validates before changing data and writes only to the requested account', () => {
  setStorageUser('user-b')
  markQuestionCompleted('fukushuu1', 'f1_q3')
  assert.throws(() => writeProgressSnapshot({ n3vjit_masteredFlashcards: 'invalid' }, 'user-a'))
  writeProgressSnapshot({ n3vjit_completedQuestions: { fukushuu1: ['f1_q2'] } }, 'user-a')
  assert.deepEqual(getCompletedQuestions(), { fukushuu1: ['f1_q3'] })
  assert.deepEqual(readProgressSnapshot('user-a'), { n3vjit_completedQuestions: { fukushuu1: ['f1_q2'] } })
})

test('merging initial account snapshots is additive, keeps the latest writing and is idempotent', () => {
  const account = { n3vjit_completedQuestions: { fukushuu1: ['f1_q2'] }, n3vjit_masteredFlashcards: ['card1'], n3vjit_customSakubun: { topic: { text: 'new', updatedAt: '2026-10-26T00:00:00Z' } }, n3vjit_wrongQuestions: { fukushuu1: { q: { count: 2, correctStreak: 0 } } } }
  const guest = { n3vjit_completedQuestions: { fukushuu1: ['f1_q1', 'f1_q2'] }, n3vjit_masteredFlashcards: ['card1', 'card2'], n3vjit_customSakubun: { topic: { text: 'old', updatedAt: '2026-10-25T00:00:00Z' } }, n3vjit_wrongQuestions: { fukushuu1: { q: { count: 1, correctStreak: 0 } } } }
  const merged = mergeProgress(account, guest)
  assert.deepEqual(merged.n3vjit_completedQuestions.fukushuu1, ['f1_q2', 'f1_q1'])
  assert.deepEqual(merged.n3vjit_masteredFlashcards, ['card1', 'card2'])
  assert.equal(merged.n3vjit_customSakubun.topic.text, 'new')
  assert.equal(merged.n3vjit_wrongQuestions.fukushuu1.q.count, 2)
  assert.equal(JSON.stringify(mergeProgress(merged, guest)), JSON.stringify(merged))
})

test('imported record names cannot modify object prototypes while merging', () => {
  const guest = JSON.parse('{"n3vjit_wrongQuestions":{"__proto__":{"n3AuthPollution":{"count":1,"correctStreak":0}}}}')
  const merged = mergeProgress({}, guest)
  assert.equal({}.n3AuthPollution, undefined)
  assert.equal(merged.n3vjit_wrongQuestions.__proto__.n3AuthPollution.count, 1)
  assert.deepEqual(getUserProfile(), { name: '', birthday: '', major: '', familyMembers: '', hobbies: '' })
})

test('a failed cloud restore rolls back the account snapshot without touching guest data or auth tokens', () => {
  markQuestionCompleted('fukushuu1', 'f1_q1')
  localStorage.setItem('n3vjit_auth:test', 'keep-session')
  setStorageUser('user-a')
  markQuestionCompleted('fukushuu1', 'f1_q2')
  const write = localStorage.setItem
  let fail = true
  localStorage.setItem = (key, value) => {
    if (key.includes('n3vjit_masteredFlashcards') && fail) { fail = false; throw new Error('Quota exceeded') }
    write(key, value)
  }
  assert.throws(() => writeProgressSnapshot({ n3vjit_completedQuestions: { fukushuu1: ['f1_q3'] }, n3vjit_masteredFlashcards: ['card1'] }))
  assert.deepEqual(getCompletedQuestions(), { fukushuu1: ['f1_q2'] })
  assert.equal(localStorage.getItem('n3vjit_auth:test'), 'keep-session')
  setStorageUser(null)
  assert.deepEqual(getCompletedQuestions(), {})
})

test('an in-flight backup import keeps its original account if the user switches accounts before the file finishes reading', async () => {
  let reader
  globalThis.FileReader = class {
    readAsText() { reader = this }
  }
  setStorageUser('user-a')
  const importing = importProgress({})
  setStorageUser('user-b')
  markQuestionCompleted('fukushuu1', 'f1_q3')
  reader.onload({ target: { result: '{"n3vjit_completedQuestions":{"fukushuu1":["f1_q2"]}}' } })
  await importing
  assert.deepEqual(getCompletedQuestions(), { fukushuu1: ['f1_q3'] })
  assert.deepEqual(readProgressSnapshot('user-a'), { n3vjit_completedQuestions: { fukushuu1: ['f1_q2'] } })
})
