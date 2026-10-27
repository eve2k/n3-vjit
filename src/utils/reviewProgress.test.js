import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { reviewCatalog, eligibleReviewCards } from './reviewLearning.js'
import { emptyReviewProgress, validReviewProgress, beginReview, answerReview, advanceReview, reviewCursor, finishReview, recordReviewResult, mergeReviewProgress } from './reviewProgress.js'
import { latestAnswer } from './reviewQuestionIds.js'
import { weakMasteryCount, weakMasteryNodes } from './roadmapContent.js'
import { getReviewProgress, startReviewTest, saveReviewAnswer, finishReviewTest, cancelReviewTest, recordQuestionResult,
  getMasteryProgress, saveMasteryProgress, markQuestionCompleted, markWrongQuestionCorrect, addWrongQuestion,
  getCompletedQuestions, setStorageUser, readProgressSnapshot, writeProgressSnapshot, resetAllProgress, parseProgressBackup } from './storage.js'
import { reconcileProgress } from './syncProgress.js'

const now = Date.parse('2026-10-27T00:00:00Z')
const question = reviewCatalog('kanji')[0]
const key = question.key
const wrong = Object.keys(question.options).find(letter => letter !== question.correctAnswer)
const mastered = () => ({ cards: { [key]: { level: 3, lastResult: 'correct', updatedAt: new Date(now).toISOString(), updateId: 'learned' } }, nodes: {} })
const options = (step, updateId = `id-${step}`) => ({ now: now + step, updateId, random: () => .25 })
const settings = { stageId: 'kanji', mode: 'multiple-choice', count: 1 }
let data
beforeEach(() => {
  data = new Map()
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
  setStorageUser('learner')
})

function completedFixture() {
  const active = beginReview(emptyReviewProgress(), mastered(), settings, options(1))
  const answered = answerReview(active, 'id-1', key, wrong, options(2))
  const finished = finishReview(answered, mastered(), 'id-1', options(3))
  return { active, answered, finished }
}

test('finish deletes all session items/answers, persists one latest result and is idempotent', () => {
  const { answered, finished } = completedFixture()
  assert.ok(answered.session.data.items.length)
  assert.equal(finished.progress.session.data, null)
  assert.equal(JSON.stringify(finished.progress).includes('"items"'), false)
  assert.equal(JSON.stringify(finished.progress).includes('"response"'), false)
  assert.deepEqual(finished.summary, { kind: 'mastered', total: 1, correct: 0, wrongKeys: [key] })
  assert.equal(finished.mastery.cards[key].level, 2)
  assert.equal(finished.mastery.cards[key].needsRecheck, true)
  assert.equal(validReviewProgress(finished.progress), true)
  const twice = finishReview(finished.progress, finished.mastery, 'id-1', options(4))
  assert.equal(twice.summary, null)
  assert.deepEqual(twice.mastery, finished.mastery)
})

test('wrong cards enter the shared weak count and can only be selected via retry', () => {
  const { finished } = completedFixture()
  assert.equal(weakMasteryCount(finished.mastery), 1)
  assert.equal(weakMasteryNodes(finished.mastery)[0].recheckQuestions[0].id, question.id)
  assert.throws(() => beginReview(finished.progress, finished.mastery, settings, options(4)), /phạm vi/)
  const retried = beginReview(finished.progress, finished.mastery, { ...settings, retryKeys: [key] }, options(4))
  const answered = answerReview(retried, 'id-4', key, question.correctAnswer, options(5))
  const passed = finishReview(answered, finished.mastery, 'id-4', options(6))
  assert.equal(passed.summary.kind, 'retry')
  assert.equal(passed.mastery.cards[key].level, 3)
  assert.equal(passed.mastery.cards[key].needsRecheck, undefined)
  assert.equal(weakMasteryCount(passed.mastery), 0)
  assert.equal(Object.keys(passed.progress.results).length, 1)
})

test('finishing with a slow device clock advances both card and result timestamps', () => {
  const future = now + 60_000
  const mastery = mastered()
  mastery.cards[key].updatedAt = new Date(future).toISOString()
  const active = beginReview(emptyReviewProgress(), mastery, settings, options(1))
  const answered = answerReview(active, 'id-1', key, wrong, options(2))
  const finished = finishReview(answered, mastery, 'id-1', options(3))
  assert.equal(finished.mastery.cards[key].level, 2)
  assert.equal(Date.parse(finished.mastery.cards[key].updatedAt), future + 1)
  assert.equal(finished.progress.results[key].answeredAt, finished.mastery.cards[key].updatedAt)
  assert.equal(validReviewProgress(finished.progress), true)
})

test('written self-correction only follows submission and commits once as correct', () => {
  const active = beginReview(emptyReviewProgress(), mastered(), { ...settings, mode: 'written' }, options(1))
  assert.throws(() => answerReview(active, 'id-1', key, 'my answer', { ...options(2), selfCorrected: true }), /nộp/)
  let answered = answerReview(active, 'id-1', key, 'my answer', options(2))
  assert.equal(mastered().cards[key].level, 3)
  answered = answerReview(answered, 'id-1', key, 'my answer', { ...options(3), selfCorrected: true })
  assert.equal(validReviewProgress(answered), true)
  const finished = finishReview(answered, mastered(), 'id-1', options(4))
  assert.equal(finished.summary.correct, 1)
  assert.equal(finished.mastery.cards[key].level, 3)
  assert.equal(finished.progress.results[key].selfCorrected, true)
})

test('active session survives reload with identical options and rejects foreign or incomplete submits', () => {
  const active = beginReview(emptyReviewProgress(), mastered(), settings, options(1))
  const restored = JSON.parse(JSON.stringify(active))
  assert.equal(validReviewProgress(restored), true)
  assert.deepEqual(restored.session.data.items, active.session.data.items)
  assert.throws(() => finishReview(restored, mastered(), 'id-1', options(2)), /trả lời đủ/)
  assert.throws(() => answerReview(restored, 'foreign', key, wrong, options(2)), /đóng/)
  assert.throws(() => answerReview(restored, 'id-1', 'renshuu3:unknown', wrong, options(2)), /không thuộc/)
  assert.throws(() => beginReview(restored, mastered(), settings, options(2)), /đang làm/)
})

test('validation rejects broken answer types and legacy snapshots without review data still import', () => {
  const active = beginReview(emptyReviewProgress(), mastered(), settings, options(1))
  active.session.data.answers[key] = { response: 'Z', selfCorrected: false }
  assert.equal(validReviewProgress(active), false)
  assert.throws(() => parseProgressBackup(JSON.stringify({ n3vjit_review: active })), /không hợp lệ/)
  assert.ok(parseProgressBackup(JSON.stringify({ n3vjit_completedQuestions: { dk1: ['dk1_q1'] } })))
  assert.equal(validReviewProgress({ results: { [key]: { correct: true, answeredAt: 'invalid', updateId: 'a', source: 'practice' } }, session: null }), false)
})

test('grammar and reading practice record real latest outcomes without backfilling legacy data', () => {
  writeProgressSnapshot({ n3vjit_completedQuestions: { dk1: ['dk1_q1'] }, n3vjit_wrongQuestions: { dk1: { dk1_q1: { count: 1, correctStreak: 1 } } } })
  assert.deepEqual(getReviewProgress(), emptyReviewProgress())
  markQuestionCompleted('dk1', 'dk1_q2')
  markWrongQuestionCorrect('dk1', 'dk1_q2', options(1))
  assert.equal(latestAnswer(getReviewProgress().results, 'dokkai:dk1_q2').correct, true)
  addWrongQuestion('dokkai', 'dk1_q2', { ...options(2), source: 'checkpoint' })
  assert.equal(latestAnswer(getReviewProgress().results, 'dk1:dk1_q2').correct, false)
  assert.equal(eligibleReviewCards('reading', {}, getReviewProgress().results).length, 0)
  markWrongQuestionCorrect('renshuu4', 'r4_q1', options(3))
  assert.equal(getReviewProgress().results['renshuu4:r4_q1'].correct, true)
  assert.deepEqual(getCompletedQuestions().dk1, ['dk1_q1', 'dk1_q2'])
  assert.deepEqual(readProgressSnapshot().n3vjit_wrongQuestions.dk1.dk1_q1, { count: 1, correctStreak: 1 })
})

test('old reading result IDs stay stored, alias lookup converges without duplicates', () => {
  const old = recordReviewResult(emptyReviewProgress(), 'dk1:dk1_q1', true, options(1))
  old.results['dk1:dk1_q1'] = old.results['dokkai:dk1_q1']
  delete old.results['dokkai:dk1_q1']
  writeProgressSnapshot({ n3vjit_review: old, n3vjit_completedQuestions: { dk1: ['dk1_q1'] } })
  recordQuestionResult('dokkai', 'dk1_q1', false, options(2))
  assert.deepEqual(Object.keys(getReviewProgress().results), ['dk1:dk1_q1'])
  assert.equal(getReviewProgress().results['dk1:dk1_q1'].correct, false)
  assert.deepEqual(getCompletedQuestions(), { dk1: ['dk1_q1'] })
})

test('storage finalization is atomic if saving review fails after the mastery write', () => {
  saveMasteryProgress(mastered())
  startReviewTest(settings, options(1))
  saveReviewAnswer('id-1', key, wrong, options(2))
  const before = readProgressSnapshot()
  const write = localStorage.setItem
  let once = true
  localStorage.setItem = (key, value) => {
    if (once && key.endsWith(':n3vjit_review')) { once = false; throw new Error('storage full') }
    write(key, value)
  }
  assert.throws(() => finishReviewTest('id-1', options(3)), /Chưa chốt/)
  assert.deepEqual(readProgressSnapshot(), before)
  assert.equal(finishReviewTest('id-1', options(4)).correct, 0)
  assert.equal(getMasteryProgress().cards[key].level, 2)
  assert.equal(finishReviewTest('id-1', options(5)), null)
  assert.equal(getMasteryProgress().cards[key].level, 2)
})

test('review storage is account scoped, guest protected, included in backup and reset', () => {
  saveMasteryProgress(mastered())
  startReviewTest(settings, options(1))
  saveReviewAnswer('id-1', key, wrong, options(2))
  const snapshot = readProgressSnapshot()
  const entries = parseProgressBackup(JSON.stringify({ version: 1, data: snapshot }))
  assert.ok(entries.some(([key]) => key === 'n3vjit_review'))
  setStorageUser('other')
  assert.deepEqual(getReviewProgress(), emptyReviewProgress())
  setStorageUser(null)
  const before = [...data]
  assert.throws(() => startReviewTest(settings), /Đăng nhập/)
  assert.throws(() => saveReviewAnswer('id-1', key, wrong), /Đăng nhập/)
  assert.throws(() => finishReviewTest('id-1'), /Đăng nhập/)
  recordQuestionResult('renshuu4', 'r4_q1', true)
  assert.deepEqual([...data], before)
  setStorageUser('learner')
  writeProgressSnapshot(snapshot)
  assert.equal(getReviewProgress().session.data.answers[key].response, wrong)
  cancelReviewTest('id-1', options(3))
  assert.equal(getReviewProgress().session.data, null)
  assert.equal(getMasteryProgress().cards[key].level, 3)
  resetAllProgress()
  assert.deepEqual(getReviewProgress(), emptyReviewProgress())
})

test('a hundred completed tests keep one latest result and one small closed-session marker', () => {
  let progress = emptyReviewProgress(), mastery = mastered()
  for (let i = 1; i <= 100; i++) {
    progress = beginReview(progress, mastery, settings, options(i * 3))
    progress = answerReview(progress, `id-${i * 3}`, key, question.correctAnswer, options(i * 3 + 1))
    const result = finishReview(progress, mastery, `id-${i * 3}`, options(i * 3 + 2))
    progress = result.progress
    mastery = result.mastery
  }
  assert.equal(Object.keys(progress.results).length, 1)
  assert.equal(progress.session.data, null)
  assert.ok(JSON.stringify(progress).length < 800)
})

test('both initial and baseline merges select whole newest results and converge on equal timestamps', () => {
  const left = recordReviewResult(emptyReviewProgress(), 'renshuu4:r4_q1', false, options(1, 'a'))
  const right = recordReviewResult(emptyReviewProgress(), 'renshuu4:r4_q1', true, options(1, 'z'))
  const a = { n3vjit_review: left }, b = { n3vjit_review: right }
  for (const base of [null, { n3vjit_review: emptyReviewProgress() }]) {
    assert.deepEqual(reconcileProgress(base, a, b).n3vjit_review, reconcileProgress(base, b, a).n3vjit_review)
    assert.equal(reconcileProgress(base, a, b).n3vjit_review.results['renshuu4:r4_q1'].correct, true)
  }
})

test('completed session cannot be resurrected by later offline edits, even after baseline advanced', () => {
  const { active, answered, finished } = completedFixture()
  const stale = structuredClone(answered)
  stale.session.updatedAt = new Date(now + 100).toISOString()
  stale.session.updateId = 'late-offline'
  const remote = { n3vjit_review: finished.progress }
  for (const base of [null, { n3vjit_review: active }, remote]) {
    const merged = reconcileProgress(base, { n3vjit_review: stale }, remote)
    assert.equal(merged.n3vjit_review.session.data, null)
    assert.equal(merged.n3vjit_review.results[key].correct, false)
  }
  const next = beginReview(finished.progress, finished.mastery, { ...settings, retryKeys: [key] }, options(4))
  assert.equal(mergeReviewProgress(stale, next).session.id, 'id-4')
})

test('flag deletion and review cleanup propagate with reset instead of reviving cache', () => {
  const { finished } = completedFixture()
  const base = { n3vjit_mastery: finished.mastery, n3vjit_review: finished.progress }
  const retry = beginReview(finished.progress, finished.mastery, { ...settings, retryKeys: [key] }, options(4))
  const answered = answerReview(retry, 'id-4', key, question.correctAnswer, options(5))
  const recovered = finishReview(answered, finished.mastery, 'id-4', options(6))
  const remote = { n3vjit_mastery: recovered.mastery, n3vjit_review: recovered.progress }
  const merged = reconcileProgress(base, base, remote)
  assert.equal(merged.n3vjit_mastery.cards[key].level, 3)
  assert.equal(merged.n3vjit_mastery.cards[key].needsRecheck, undefined)
  assert.equal(merged.n3vjit_review.session.data, null)
  assert.deepEqual(reconcileProgress(remote, remote, {}), {})
  assert.deepEqual(reconcileProgress(remote, {}, remote), {})
})

test('saved cursor keeps submitted feedback after reload and advances only after an answer', () => {
  const q2 = reviewCatalog('kanji')[1]
  const mastery = mastered()
  mastery.cards[q2.key] = { ...mastery.cards[key] }
  let progress = beginReview(emptyReviewProgress(), mastery, { ...settings, count: 2 }, options(1))
  assert.throws(() => advanceReview(progress, 'id-1', options(2)), /trả lời/)
  const first = progress.session.data.items[0]
  const q = reviewCatalog('kanji').find(q => q.key === first.key)
  progress = answerReview(progress, 'id-1', first.key, q.correctAnswer, options(2))
  const restored = JSON.parse(JSON.stringify(progress))
  assert.equal(reviewCursor(restored.session), 0)
  assert.ok(restored.session.data.answers[first.key])
  progress = advanceReview(restored, 'id-1', options(3))
  assert.equal(reviewCursor(progress.session), 1)
  assert.equal(validReviewProgress(progress), true)
  const invalid = structuredClone(progress)
  invalid.session.data.cursor = 2
  assert.equal(validReviewProgress(invalid), false)
  delete restored.session.data.cursor
  assert.equal(reviewCursor(restored.session), 1)
  assert.equal(validReviewProgress(restored), true)
})
