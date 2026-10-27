import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyReviewAnswer, answerCard, createRound, needsConsolidation, validMasteryProgress } from './masteryLearning.js'
import { reviewCatalog, eligibleReviewCards, selectReviewCards, createReviewItems, gradeReviewAnswer, normalizeWrittenAnswer } from './reviewLearning.js'
import { READING_ID_MAP, canonicalReviewKey, latestAnswer } from './reviewQuestionIds.js'
import { usableQuestion } from './questionUsability.js'

const now = Date.parse('2026-10-27T00:00:00Z')
const card = (level = 3) => ({ level, lastResult: 'correct', updatedAt: new Date(now).toISOString(), updateId: 'initial' })
const result = (correct, time = now, updateId = 'answer') => ({ correct, answeredAt: new Date(time).toISOString(), updateId, source: 'practice' })
const random = () => .25

test('review wrong demotes once; correct keeps level; duplicate updates cannot demote again', () => {
  const wrong = applyReviewAnswer(card(), false, now + 1, 'wrong')
  assert.equal(wrong.level, 2)
  assert.equal(wrong.needsRecheck, true)
  assert.equal(needsConsolidation(wrong), true)
  assert.equal(applyReviewAnswer(wrong, false, now + 1, 'wrong'), wrong)
  const slowClock = applyReviewAnswer(wrong, false, now - 1, 'slow-clock')
  assert.equal(slowClock.level, 1)
  assert.equal(Date.parse(slowClock.updatedAt), Date.parse(wrong.updatedAt) + 1)
  assert.equal(applyReviewAnswer(card(), true, now + 1, 'correct').level, 3)
  assert.equal(applyReviewAnswer(card(0), false, now + 1, 'wrong').level, 0)
  assert.equal(wrong.lastReviewedAt, new Date(now + 1).toISOString())
})

test('both node learning and retry restore flagged level 2 to 3 or demote to 1 and clear flag', () => {
  const flagged = applyReviewAnswer(card(), false, now + 1, 'wrong')
  for (const correct of [true, false]) {
    const expected = correct ? 3 : 1
    const retried = applyReviewAnswer(flagged, correct, now + 2, 'retry')
    assert.equal(retried.level, expected)
    assert.equal(Object.hasOwn(retried, 'needsRecheck'), false)
    const round = createRound(['a'], [], { a: flagged }, 1, 0, now + 2, 'round')
    // Recovery must also work when the card already advanced earlier this round.
    round.advanced = ['a']
    const learned = answerCard(round, { a: flagged }, correct, now + 3, 'node-answer')
    assert.equal(learned.cards.a.level, expected)
    assert.equal(Object.hasOwn(learned.cards.a, 'needsRecheck'), false)
    assert.equal(validMasteryProgress({ cards: learned.cards, nodes: { n: learned.session } }), true)
  }
})

test('mastered pool only accepts level 3; retry pool includes flagged level 2', () => {
  const questions = reviewCatalog('kanji').slice(0, 4)
  const cards = Object.fromEntries(questions.map((q, index) => [q.key, card(index)]))
  cards[questions[2].key] = applyReviewAnswer(card(), false, now + 1, 'wrong')
  const progress = { cards, nodes: {} }
  assert.deepEqual(eligibleReviewCards('kanji', progress).map(q => q.key), [questions[3].key])
  assert.deepEqual(eligibleReviewCards('kanji', progress, {}, { retryKeys: [questions[2].key] }).map(q => q.key), [questions[2].key])
  assert.deepEqual(eligibleReviewCards('kanji', progress, {}, { retryKeys: [questions[0].key, questions[1].key] }), [])
  assert.equal(eligibleReviewCards('kanji', progress, {}, { lessonIds: [] }).length, 0)
})

test('catalog is stable per stage and duplicate choices are unusable in tests and learning rounds', () => {
  assert.equal(reviewCatalog('kanji'), reviewCatalog('kanji'))
  assert.equal(reviewCatalog('reading'), reviewCatalog('reading'))
  assert.notEqual(reviewCatalog('kanji'), reviewCatalog('reading'))
  const duplicate = reviewCatalog('grammar').find(q => q.id === 'r4_q35')
  assert.equal(usableQuestion(duplicate), false)
  assert.equal(eligibleReviewCards('grammar', {}, { [duplicate.key]: result(true) }).some(q => q.id === 'r4_q35'), false)
  assert.throws(() => createReviewItems([duplicate], 'multiple-choice', 'grammar', random), /không có đủ/i)
  const synthetic = { ...reviewCatalog('kanji')[0], key: 'renshuu3:duplicate', options: { A: 'Ａ', B: 'A' }, correctAnswer: 'A' }
  assert.equal(usableQuestion(synthetic), false)
  const own = [synthetic, reviewCatalog('kanji')[0]].filter(usableQuestion).map(q => q.key)
  const old = [synthetic, reviewCatalog('kanji')[1]].filter(usableQuestion).map(q => q.key)
  assert.deepEqual(createRound(own, old, {}, 1, 0, now, 'round').queue, own)
})

test('latest grammar/reading correctness is explicit, not inferred from completion or legacy mistakes', () => {
  assert.equal(eligibleReviewCards('grammar', { completedQuestions: { renshuu4: ['r4_q1'] } }).length, 0)
  const results = { 'renshuu4:r4_q1': result(true), 'renshuu4:r4_q2': result(false) }
  assert.deepEqual(eligibleReviewCards('grammar', {}, results).map(q => q.key), ['renshuu4:r4_q1'])
  const old = { 'dk1:dk1_q1': result(true) }
  assert.equal(eligibleReviewCards('reading', {}, old).length, 1)
  assert.equal(eligibleReviewCards('reading', {}, old)[0].lessonId, 'dk1')
  assert.equal(reviewCatalog('reading').length, 48)
})

test('reading aliases preserve IDs and choose latest record without duplicate cards', () => {
  assert.equal(Object.keys(READING_ID_MAP).length, 48)
  assert.equal(canonicalReviewKey('dk2:dk2_q5'), 'dokkai:dk2_q5')
  assert.equal(canonicalReviewKey('dk2:unknown'), 'dk2:unknown')
  const records = { 'dk2:dk2_q5': result(true), 'dokkai:dk2_q5': result(false, now + 1, 'new') }
  const before = structuredClone(records)
  assert.equal(latestAnswer(records, 'dk2:dk2_q5').correct, false)
  assert.equal(eligibleReviewCards('reading', {}, records).length, 0)
  records['dk2:dk2_q5'] = result(true, now + 2, 'newer')
  assert.equal(eligibleReviewCards('reading', {}, records).length, 1)
  assert.deepEqual(Object.keys(records), Object.keys(before))
})

test('selection caps count, deduplicates, scopes lessons, and prioritizes never/old reviewed cards', () => {
  const pool = reviewCatalog('kanji').slice(0, 15)
  const cards = Object.fromEntries(pool.map(q => [q.key, { ...card(), lastReviewedAt: new Date(now).toISOString() }]))
  delete cards[pool[3].key].lastReviewedAt
  cards[pool[4].key].lastReviewedAt = new Date(now - 1000).toISOString()
  const picked = selectReviewCards(pool, { count: 2, prioritizeOld: true, mastery: { cards }, random })
  assert.deepEqual(picked.map(q => q.key), [pool[3].key, pool[4].key])
  assert.equal(selectReviewCards(pool, { random }).length, 10)
  assert.equal(selectReviewCards(pool.slice(0, 3), { random }).length, 3)
  assert.throws(() => selectReviewCards(pool, { count: 16 }), /phạm vi/)
  assert.throws(() => selectReviewCards([], {}), /phạm vi/)
  assert.throws(() => selectReviewCards([pool[0], pool[0]], { count: 2 }), /phạm vi/)
  assert.equal(eligibleReviewCards('kanji', { cards }, {}, { lessonIds: ['lesson-2'] }).length, 5)
})

test('true/false uses existing options, balanced truth, and matches 1=true/2=false semantics', () => {
  const pool = reviewCatalog('kanji').slice(0, 10)
  const items = createReviewItems(pool, 'true-false', 'kanji', random)
  assert.equal(items.filter((item, index) => gradeReviewAnswer(item, pool[index], true)).length, 5)
  items.forEach((item, index) => {
    assert.ok(Object.hasOwn(pool[index].options, item.candidate))
    assert.notEqual(gradeReviewAnswer(item, pool[index], true), gradeReviewAnswer(item, pool[index], false))
  })
})

test('written normalization handles widths and trim, keeps Japanese meaning distinctions', () => {
  assert.equal(normalizeWrittenAnswer('　Ａ１２ ｶﾞ　'), 'A12 ガ')
  assert.notEqual(normalizeWrittenAnswer('か'), normalizeWrittenAnswer('カ'))
  assert.notEqual(normalizeWrittenAnswer('あ い'), normalizeWrittenAnswer('あい'))
  const q = { key: 'renshuu2:test', options: { A: 'Ａ１２', B: 'B' }, correctAnswer: 'A' }
  const [item] = createReviewItems([q], 'written', 'vocab', random)
  assert.equal(gradeReviewAnswer(item, q, ' A12 '), true)
  assert.equal(gradeReviewAnswer(item, q, 'wrong'), false)
  assert.equal(gradeReviewAnswer(item, q, 'wrong', true), true)
  assert.throws(() => createReviewItems([q], 'written', 'grammar'), /Chế độ/)
  const [mc] = createReviewItems([q], 'multiple-choice', 'vocab', random)
  assert.deepEqual(new Set(mc.choices), new Set(['A', 'B']))
  assert.throws(() => gradeReviewAnswer(mc, q, 'B', true), /tự luận/)
})

test('legacy mastery records remain valid, invalid recovery flags are rejected', () => {
  assert.equal(validMasteryProgress({ cards: { a: card() }, nodes: {} }), true)
  assert.equal(validMasteryProgress({ cards: { a: { ...card(), needsRecheck: true } }, nodes: {} }), false)
  assert.equal(validMasteryProgress({ cards: { a: { ...card(), lastReviewedAt: 'invalid' } }, nodes: {} }), false)
})
