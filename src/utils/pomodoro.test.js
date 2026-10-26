import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextPomodoroStage, POMODORO_DEFAULTS, POMODORO_LIMITS } from './pomodoro.js'

test('Pomodoro defaults and duration limits support user adjustments', () => {
  assert.deepEqual(POMODORO_DEFAULTS, { focus: 25, short: 5, long: 15, longEvery: 4 })
  assert.deepEqual(POMODORO_LIMITS, { focus: [1, 120], short: [1, 60], long: [1, 90], longEvery: [2, 8] })
})

test('a focus stage selects a short or long break and increments completed sessions', () => {
  assert.deepEqual(nextPomodoroStage('focus', 0, 4), { kind: 'short', completed: 1 })
  assert.deepEqual(nextPomodoroStage('focus', 3, 4), { kind: 'long', completed: 4 })
})

test('either break returns to focus without incrementing the completed count', () => {
  assert.deepEqual(nextPomodoroStage('short', 2, 4), { kind: 'focus', completed: 2 })
  assert.deepEqual(nextPomodoroStage('long', 4, 4), { kind: 'focus', completed: 4 })
})

test('unknown Pomodoro stages are rejected', () => {
  assert.throws(() => nextPomodoroStage('idle', 0, 4), /Unknown Pomodoro stage/)
})
