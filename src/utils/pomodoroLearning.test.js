import test from 'node:test'
import assert from 'node:assert/strict'
import { POMODORO_UNITS, estimatePomodoroRecall, getNextPomodoroUnit, getPomodoroUnitStatus, pomodoroContentCounts, pomodoroCycleStats, suggestPomodoroGap } from './pomodoroLearning.js'
import { mergePomodoroLearning } from './mergeProgress.js'
import { parseProgressBackup } from './storage.js'
import { reconcileProgress } from './syncProgress.js'

test('Pomodoro curriculum includes the full deduplicated answerable set', () => {
  assert.deepEqual(pomodoroContentCounts(), { quiz: 257, reading: 48, flashcards: 189, linkedFlashcards: 159, total: 335 })
  assert.equal(POMODORO_UNITS.length, 335)
  assert.equal(POMODORO_UNITS.filter(unit => unit.question && unit.flashcard).length, 159)
})

test('two consecutive correct answers master a unit and a wrong answer resets its streak', () => {
  const unit = POMODORO_UNITS[0]
  const events = [
    { id: 'a', unitId: unit.id, cycleId: 'cycle', correct: true, at: '2026-01-01T00:00:00.000Z', dueAtStep: 8 },
    { id: 'b', unitId: unit.id, cycleId: 'cycle', correct: true, at: '2026-01-01T00:01:00.000Z', dueAtStep: 9 },
  ]
  assert.equal(getPomodoroUnitStatus(unit, events, 'cycle').status, 'mastered')
  assert.equal(pomodoroCycleStats([unit], events, 'cycle').mastered, 1)
  assert.equal(getPomodoroUnitStatus(unit, [...events, { ...events[1], id: 'c', correct: false }], 'cycle').status, 'new')
})

test('scheduler presents new items first, then due review and repeats misses quickly', () => {
  const units = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const progress = { events: [{ id: 'e1', unitId: 'a', cycleId: 'round', correct: false, at: '2026-01-01T00:00:00.000Z', dueAtStep: 3 }] }
  assert.equal(getNextPomodoroUnit(units, progress, 'round').id, 'b')
  progress.events.push({ ...progress.events[0], id: 'e2', unitId: 'b', dueAtStep: 5 })
  assert.equal(getNextPomodoroUnit(units, progress, 'round').id, 'c')
  progress.events.push({ ...progress.events[0], id: 'e3', unitId: 'c', dueAtStep: 8 })
  assert.equal(getNextPomodoroUnit(units, progress, 'round').id, 'a')
})

test('recall model returns the requested interval windows', () => {
  assert.ok([2, 3].includes(suggestPomodoroGap([], 'unit', false)))
  assert.ok([5, 6, 7, 8, 9, 10].includes(suggestPomodoroGap([], 'unit', true)))
  assert.ok(estimatePomodoroRecall([], 'unit', 5) > 0 && estimatePomodoroRecall([], 'unit', 5) < 1)
})

test('device sync merges Pomodoro events by ID and retains completed cycles', () => {
  const left = { cycles: [{ id: 'round', startedAt: '2026-01-01T00:00:00.000Z', completedAt: null }], events: [{ id: 'a', unitId: 'u1', cycleId: 'round', correct: true, at: '2026-01-01T00:01:00.000Z', dueAtStep: 6 }] }
  const right = { cycles: [{ id: 'round', startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T01:00:00.000Z' }], events: [{ ...left.events[0] }, { id: 'b', unitId: 'u2', cycleId: 'round', correct: false, at: '2026-01-01T00:02:00.000Z', dueAtStep: 4 }] }
  const merged = mergePomodoroLearning(left, right)
  assert.equal(merged.events.length, 2)
  assert.equal(merged.cycles[0].completedAt, '2026-01-01T01:00:00.000Z')
  const base = { n3vjit_pomodoroLearning: left }
  const synced = reconcileProgress(base, { n3vjit_pomodoroLearning: left }, { n3vjit_pomodoroLearning: right })
  assert.equal(synced.n3vjit_pomodoroLearning.events.length, 2)
})

test('progress backup accepts valid Pomodoro events and rejects malformed records', () => {
  const valid = { cycles: [{ id: 'round', startedAt: '2026-01-01T00:00:00.000Z', completedAt: null }], events: [{ id: 'event', unitId: 'unit', cycleId: 'round', contentType: 'quiz', correct: true, at: '2026-01-01T00:01:00.000Z', dueAtStep: 6 }] }
  assert.equal(parseProgressBackup(JSON.stringify({ n3vjit_pomodoroLearning: valid })).length, 1)
  assert.throws(() => parseProgressBackup(JSON.stringify({ n3vjit_pomodoroLearning: { cycles: [], events: [{ ...valid.events[0], dueAtStep: -2 }] } })), /không hợp lệ/)
})
