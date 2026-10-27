import { test } from 'node:test'
import assert from 'node:assert/strict'
import { weakMasteryNodes, weakMasteryCount, stageProgress, continueLessonIndex, stages, lessonQuestions, stageQuestions } from './roadmapContent.js'
import { usableQuestion } from './questionUsability.js'

test('vocabulary nodes keep source boundaries and cover every question exactly once', () => {
  const stage = stages.find(stage => stage.id === 'vocab')
  const lessons = stage.lessons.map((_, index) => lessonQuestions(stage, index))
  lessons.forEach((questions, index) => {
    assert.ok(questions.length > 0)
    assert.ok(questions.every(question => question.section === (index < 4 ? 'renshuu2' : 'fukushuu1')))
    assert.equal(stage.lessons[index], index < 4 ? `Từ vựng ${index + 1}` : `Đồng nghĩa ${index - 3}`)
  })
  const ids = lessons.flat().map(q => `${q.section}:${q.id}`)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(ids, stageQuestions(stage).map(q => `${q.section}:${q.id}`))
})

test('chỉ gom thẻ yếu trong các node đã học', () => {
  assert.deepEqual(weakMasteryNodes({ cards: {}, nodes: {} }), [])
  const nodes = weakMasteryNodes({ cards: { 'renshuu3:r3_q1': { level: 2 }, 'renshuu3:r3_q2': { level: 1 } }, nodes: { 'kanji:lesson-1': {} } })
  assert.equal(nodes.length, 1)
  assert.equal(nodes[0].questions.length, 1)
  assert.ok(nodes[0].questions.some(question => question.id === 'r3_q2'))
  assert.ok(!nodes[0].questions.some(question => question.id === 'r3_q1'))
})


test('thống kê bốn bậc và tiếp tục phiên gần nhất chưa thành thạo', () => {
  const stage = stages[0]
  const mastery = { cards: { 'renshuu3:r3_q1': { level: 2 }, 'renshuu3:r3_q2': { level: 1 } }, nodes: { 'kanji:lesson-1': { updatedAt: '2026-10-01T00:00:00Z' }, 'kanji:lesson-3': { updatedAt: '2026-10-02T00:00:00Z' } } }
  assert.deepEqual(stageProgress(stage, {}, mastery).counts, [0, 1, 1, 0])
  assert.equal(stageProgress(stage, {}, mastery).unseen, 48)
  assert.equal(continueLessonIndex(stage, {}, mastery), 2)
  assert.equal(continueLessonIndex(stage, {}, {}), 0)
  assert.equal(weakMasteryCount(mastery), 1)
})

test('node đã qua nhưng chưa thành thạo vẫn có thể tiếp tục; chặng cũ dùng câu đã làm', () => {
  const stage = stages[0]
  const cards = Object.fromEntries(stageQuestionsForFirst().map(q => [`${q.section}:${q.id}`, { level: 2 }]))
  const mastery = { cards, nodes: { 'kanji:lesson-1': { completedRounds: 3, updatedAt: '2026-10-02T00:00:00Z' } } }
  assert.equal(stageProgress(stage, {}, mastery).passed, 1)
  assert.equal(continueLessonIndex(stage, {}, mastery), 0)
  assert.equal(continueLessonIndex(stages[3], {}, {}), 0)
})
function stageQuestionsForFirst() { return stages[0].source.length ? Array.from({ length: 5 }, (_, i) => ({ section: 'renshuu3', id: `r3_q${i+1}` })) : [] }

test('câu trùng lựa chọn không chặn hoàn tất chặng ngữ pháp', () => {
  const grammar = stages.find(stage => stage.id === 'grammar')
  const usable = stageQuestions(grammar).filter(usableQuestion)
  assert.equal(usable.length, 47)
  assert.equal(usable.some(question => question.id === 'r4_q35'), false)
  const completed = { renshuu4: usable.map(question => question.id) }
  assert.equal(stageProgress(grammar, completed).passed, grammar.lessons.length)
})


test('chỉ thẻ đã gặp ở bậc 0 hoặc 1 được tính cần ôn', () => {
  const progress = { cards: { 'renshuu3:r3_q1': { level: 0 }, 'renshuu3:r3_q2': { level: 1 }, 'renshuu3:r3_q3': { level: 2 } }, nodes: { 'kanji:lesson-1': {} } }
  assert.equal(weakMasteryCount(progress), 2)
  const summary = stageProgress(stages[0], {}, progress)
  assert.deepEqual(summary.counts, [1, 1, 1, 0])
  assert.equal(summary.unseen, 47)
  assert.equal(summary.total, 50)
})
