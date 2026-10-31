import { test } from 'node:test'
import assert from 'node:assert/strict'
import { answerCard, advanceAfterFeedback, applyReviewAnswer, createRound, currentRoundSituation, enterNodeRound, nodeLearningDecision, nodeStatus, mergeMasteryProgress, summaryRouteDecision, validMasteryProgress } from './masteryLearning.js'
const time = Date.parse('2026-10-27T00:00:00Z')
const cards = Object.fromEntries(['a','b','c','d','e'].map(key => [key, { level: 0, lastResult: 'wrong', updatedAt: new Date(time).toISOString(), updateId: key }]))
test('điều hướng kết quả theo trạng thái vòng học', () => {
  assert.equal(summaryRouteDecision(null), 'preview')
  assert.equal(summaryRouteDecision({ queue: ['a'], feedback: null, completedRounds: 1 }), 'fallback')
  assert.equal(summaryRouteDecision({ queue: [], feedback: { key: 'a' }, completedRounds: 0 }), 'fallback')
  assert.equal(summaryRouteDecision({ queue: [], feedback: null, completedRounds: 1 }), 'summary')
  assert.equal(summaryRouteDecision({ queue: [], feedback: null, completedRounds: 0 }), 'fallback')
})
test('bậc và giới hạn tăng trong vòng', () => {
  let session = createRound(['a'], [], cards, 1, 0, time, 's')
  let result = answerCard(session, cards, true, time + 1, '1')
  assert.equal(result.cards.a.level, 1)
  session = { ...advanceAfterFeedback(result.session, time + 2, '2'), queue: ['a'] }
  result = answerCard(session, result.cards, true, time + 3, '3')
  assert.equal(result.cards.a.level, 1)
  session = { ...advanceAfterFeedback(result.session, time + 4, '4'), queue: ['a'] }
  result = answerCard(session, result.cards, false, time + 5, '5')
  assert.equal(result.cards.a.level, 0)
})
test('chèn lại sau hai câu và giới hạn hai lần', () => {
  let session = createRound(['a','b','c','d'], [], cards, 1, 0, time, 's')
  let result = answerCard(session, cards, false, time + 1, '1')
  assert.deepEqual(result.session.queue, ['b','c','a','d'])
  session = { ...advanceAfterFeedback(result.session, time + 2, '2'), queue: ['a'], requeues: { a: 2 } }
  result = answerCard(session, result.cards, false, time + 3, '3')
  assert.deepEqual(result.session.queue, [])
})
test('trộn thẻ yếu và điều kiện qua node', () => {
  const session = createRound(['a','b','c','d','e'], ['x','y'], { ...cards, x: { level: 2 }, y: { level: 0 } }, 1, 0, time, 's')
  assert.equal(session.queue[0], 'y')
  assert.equal(createRound(['a'], ['x'], { ...cards, x: { level: 0 } }, 1, 0, time, 's').queue.length, 1)
  assert.equal(nodeStatus(['a'], cards, 3).passed, true)
  assert.equal(nodeStatus(['a'], { a: { level: 3 } }).mastered, true)
  assert.equal(validMasteryProgress({ cards, nodes: { n: session } }), true)
})
test('gộp trạng thái theo thời điểm', () => {
  const newer = { ...cards.a, level: 2, updatedAt: new Date(time + 1).toISOString() }
  assert.equal(mergeMasteryProgress({ cards: { a: cards.a } }, { cards: { a: newer } }).cards.a.level, 2)
})
test('đồng hồ chậm vẫn tạo bản thẻ mới hơn', () => {
  const future = time + 60_000
  const previous = { ...cards.a, updatedAt: new Date(future).toISOString() }
  const session = createRound(['a'], [], { a: previous }, 1, 0, future, 'start')
  const answer = answerCard(session, { a: previous }, true, time, 'slow-clock')
  assert.equal(answer.cards.a.level, 1)
  assert.equal(Date.parse(answer.cards.a.updatedAt), future + 1)
  assert.equal(validMasteryProgress({ cards: answer.cards, nodes: { n: answer.session } }), true)
})
test('phục hồi phản hồi và chỉ hoàn tất vòng một lần', () => {
  let result = answerCard(createRound(['a'], [], cards, 1, 0, time, 's'), cards, true, time + 1, 'a')
  const restored = JSON.parse(JSON.stringify({ cards: result.cards, nodes: { n: result.session } }))
  assert.equal(validMasteryProgress(restored), true)
  assert.equal(restored.nodes.n.feedback.key, 'a')
  const finished = advanceAfterFeedback(restored.nodes.n, time + 2, 'b')
  assert.equal(finished.completedRounds, 1)
  assert.equal(advanceAfterFeedback(finished, time + 3, 'c').completedRounds, 1)
})
test('hai câu sai được hỏi lại theo thứ tự sai', () => {
  let session = createRound(['a','b','c','d','e'], [], cards, 1, 0, time, 's')
  let result = answerCard(session, cards, false, time + 1, 'a')
  session = advanceAfterFeedback(result.session, time + 2, 'b')
  result = answerCard(session, result.cards, false, time + 3, 'c')
  assert.ok(result.session.queue.indexOf('a') < result.session.queue.indexOf('b'))
})

test('tình huống kết quả: 80%, ba vòng, node cuối và thành thạo', async () => {
  const { roundSummarySituation } = await import('./masteryLearning.js')
  const threshold = roundSummarySituation({ a: 2, b: 2, c: 2, d: 2, e: 1 }, 1, false)
  assert.equal(threshold.threshold, true)
  assert.equal(threshold.canAdvance, true)
  assert.equal(threshold.mastered, false)
  assert.equal(roundSummarySituation({ a: 0, b: 1 }, 2, false).canAdvance, false)
  const maximum = roundSummarySituation({ a: 0, b: 1 }, 3, true)
  assert.equal(maximum.canAdvance, true)
  assert.equal(maximum.threshold, false)
  assert.equal(maximum.isLastNode, true)
  assert.equal(maximum.minimumRounds, 3)
  assert.equal(roundSummarySituation({ a: 3, b: 3 }, 3, false).mastered, true)
})

test('lưu ảnh chụp vòng và thẻ sai qua phục hồi', async () => {
  const { roundChanges } = await import('./masteryLearning.js')
  const before = { a: { ...cards.a, level: 1 }, b: { ...cards.b, level: 2 } }
  const session = createRound(['a', 'b'], [], before, 1, 0, time, 's')
  let answer = answerCard(session, before, false, time + 1, 'a1')
  answer = { ...answer, session: advanceAfterFeedback(answer.session, time + 2, 'a2', answer.cards) }
  answer = answerCard(answer.session, answer.cards, true, time + 3, 'b1')
  answer.session = { ...answer.session, queue: [] }
  const finished = advanceAfterFeedback(answer.session, time + 4, 'end', answer.cards)
  const restored = JSON.parse(JSON.stringify({ cards: answer.cards, nodes: { n: finished } }))
  assert.equal(validMasteryProgress(restored), true)
  assert.deepEqual(roundChanges(restored.nodes.n.summary), { up: 1, down: 1 })
  assert.deepEqual(restored.nodes.n.summary.wrongKeys, ['a'])
})

test('node hoàn tất được mở vòng mới cho thẻ bị hạ bậc sau kiểm tra', () => {
  const keys = ['a', 'b', 'c']
  assert.deepEqual(nodeLearningDecision(keys, {}, null), { action: 'start', round: 1, weakCount: 3 })
  const mastered = Object.fromEntries(keys.map(key => [key, { ...cards[key], level: 3, lastResult: 'correct' }]))
  const finished = { ...createRound(keys, [], mastered, 3, 2, time, 'round-3'), queue: [], completedRounds: 3,
    summary: { round: 3, startLevels: { a: 2, b: 2, c: 2 }, endLevels: { a: 3, b: 3, c: 3 }, wrongKeys: [] } }
  assert.equal(nodeLearningDecision(keys, mastered, { ...finished, queue: ['b'] }).action, 'resume')
  assert.equal(nodeLearningDecision(keys, mastered, finished).action, 'summary')
  const afterTest = { ...mastered, b: applyReviewAnswer(mastered.b, false, time + 1, 'review-wrong') }
  assert.equal(afterTest.b.needsRecheck, true)
  assert.deepEqual(nodeLearningDecision(keys, afterTest, finished), { action: 'review', round: 4, weakCount: 1 })
  const entry = enterNodeRound(keys, ['older'], { ...afterTest, older: { ...cards.a, level: 0 } }, finished, time - 1, 'round-4')
  assert.deepEqual(entry.session.queue, ['b'])
  assert.equal(entry.session.completedRounds, 3)
  assert.equal(Date.parse(entry.session.updatedAt), Date.parse(finished.updatedAt) + 1)
  const recovered = answerCard(entry.session, afterTest, true, time + 3, 'recovered').cards.b
  assert.equal(recovered.level, 3)
  assert.equal(recovered.needsRecheck, undefined)
  const failed = answerCard(entry.session, afterTest, false, time + 3, 'failed').cards.b
  assert.equal(failed.level, 1)
  assert.equal(failed.needsRecheck, undefined)
})

test('kết quả vòng dùng bậc hiện tại sau bài kiểm tra', () => {
  const keys = ['a', 'b']
  const snapshot = { endLevels: { a: 3, b: 3 } }
  const mastered = { a: { ...cards.a, level: 3 }, b: { ...cards.b, level: 3 } }
  const before = currentRoundSituation(keys, mastered, 3, false, snapshot)
  assert.equal(before.mastered, true)
  assert.equal(before.changedSinceRound, false)
  const afterTest = { ...mastered, b: applyReviewAnswer(mastered.b, false, time + 1, 'review') }
  const after = currentRoundSituation(keys, afterTest, 3, false, snapshot)
  assert.equal(after.mastered, false)
  assert.deepEqual(after.counts, [0, 0, 1, 1])
  assert.equal(after.changedSinceRound, true)
})
