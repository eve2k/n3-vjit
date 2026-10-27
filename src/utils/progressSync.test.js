import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAuthClient } from '../services/authClient.js'
import { createProgressSync } from '../services/progressSync.js'
import { reconcileProgress, sameProgress } from './syncProgress.js'
import { beginReview, answerReview, finishReview, recordReviewResult, emptyReviewProgress } from './reviewProgress.js'
import { reviewCatalog } from './reviewLearning.js'
import { createRound, answerCard } from './masteryLearning.js'

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

test('account-bound progress requests reject a different signed-in user before accessing the database', async () => {
  const calls = []
  const client = createAuthClient({ url: 'https://project.supabase.co', publicKey: 'sb_publishable_test', fetchImpl: async url => {
    calls.push(url)
    return reply({ access_token: 'app-access', refresh_token: 'app-refresh', expires_in: 3600, user: { id: 'signed-in-user' } })
  } })
  await client.signIn('learner@example.com', 'test-password')
  await assert.rejects(client.loadProgress('different-user'), { code: 'session_not_found' })
  await assert.rejects(client.saveProgress({}, null, 'different-user'), { code: 'session_not_found' })
  assert.equal(calls.length, 1)
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

test('mastery merges independent cards and selects the newest complete record', () => {
  const item = (level, updatedAt, updateId) => ({ level, lastResult: 'correct', updatedAt, updateId })
  const base = { n3vjit_mastery: { cards: { a: item(0, '2026-01-01T00:00:00Z', 'a') }, nodes: {} } }
  const local = { n3vjit_mastery: { cards: { a: item(1, '2026-01-02T00:00:00Z', 'b'), b: item(1, '2026-01-02T00:00:00Z', 'c') }, nodes: {} } }
  const remote = { n3vjit_mastery: { cards: { a: item(2, '2026-01-03T00:00:00Z', 'd'), c: item(1, '2026-01-03T00:00:00Z', 'e') }, nodes: {} } }
  const result = reconcileProgress(base, local, remote)
  assert.equal(result.n3vjit_mastery.cards.a.level, 2)
  assert.ok(result.n3vjit_mastery.cards.b)
  assert.ok(result.n3vjit_mastery.cards.c)
  const firstSync = reconcileProgress(null, local, remote)
  assert.equal(firstSync.n3vjit_mastery.cards.a.level, 2)
})

test('two browser coordinators sync review cleanup, node recovery, offline edits and optimistic conflicts', async () => {
  const now = Date.parse('2026-10-27T00:00:00Z')
  const q = reviewCatalog('kanji')[0]
  const mastered = { cards: { [q.key]: { level: 3, lastResult: 'correct', updatedAt: new Date(now).toISOString(), updateId: 'learned' } }, nodes: {} }
  const opts = step => ({ now: now + step, updateId: `event-${step}`, random: () => .25 })
  const active = beginReview(emptyReviewProgress(), mastered, { stageId: 'kanji', count: 1 }, opts(1))
  let cloud = null, version = 0, offline = false, conflict = false
  const load = async () => {
    if (offline) throw Object.assign(new Error('offline'), { code: 'network_error' })
    return cloud && clone(cloud)
  }
  const save = async (data, stamp) => {
    if (conflict) { conflict = false; cloud.updated_at = `v${++version}`; throw Object.assign(new Error('conflict'), { status: 409 }) }
    if (stamp !== (cloud?.updated_at || null)) throw Object.assign(new Error('conflict'), { status: 409 })
    cloud = { data: clone(data), updated_at: `v${++version}` }
    return clone(cloud)
  }
  const a = fixture({ initial: { n3vjit_mastery: mastered, n3vjit_review: active }, load, save })
  const b = fixture({ load, save })
  await a.sync.syncNow()
  await b.sync.syncNow()
  assert.deepEqual(b.local().n3vjit_review.session.data.items, active.session.data.items)
  const wrong = Object.keys(q.options).find(letter => letter !== q.correctAnswer)
  const answered = answerReview(active, 'event-1', q.key, wrong, opts(2))
  const finished = finishReview(answered, mastered, 'event-1', opts(3))
  a.edit({ n3vjit_mastery: finished.mastery, n3vjit_review: finished.progress })
  await a.sync.syncNow()
  await b.sync.syncNow()
  assert.equal(b.local().n3vjit_review.session.data, null)
  assert.equal(b.local().n3vjit_mastery.cards[q.key].needsRecheck, true)

  const round = createRound([q.key], [], b.local().n3vjit_mastery.cards, 1, 0, now + 4, 'round')
  const recovered = answerCard(round, b.local().n3vjit_mastery.cards, true, now + 5, 'node-answer')
  b.edit({ ...b.local(), n3vjit_mastery: { cards: recovered.cards, nodes: { 'kanji:lesson-1': recovered.session } } })
  await b.sync.syncNow()
  const offlineEdit = recordReviewResult(a.local().n3vjit_review, 'renshuu4:r4_q1', true, opts(6))
  offline = true
  a.edit({ ...a.local(), n3vjit_review: offlineEdit })
  await a.sync.syncNow()
  assert.equal(a.states.at(-1).status, 'offline')
  assert.equal(a.local().n3vjit_review.results['renshuu4:r4_q1'].correct, true)
  offline = false
  conflict = true
  await a.sync.syncNow()
  await b.sync.syncNow()
  for (const device of [a, b]) {
    assert.equal(device.states.at(-1).status, 'synced')
    assert.equal(device.local().n3vjit_mastery.cards[q.key].level, 3)
    assert.equal(device.local().n3vjit_mastery.cards[q.key].needsRecheck, undefined)
    assert.equal(device.local().n3vjit_review.session.data, null)
    assert.equal(device.local().n3vjit_review.results['renshuu4:r4_q1'].correct, true)
    device.sync.stop()
  }
})
