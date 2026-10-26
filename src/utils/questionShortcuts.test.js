import assert from 'node:assert/strict'
import { test } from 'node:test'
import { handleQuestionShortcut } from './questionShortcuts.js'

function fixture(options = { A: 'a', B: 'b', C: 'c', D: 'd' }) {
  const calls = { confirmed: [], next: 0 }
  const state = {
    question: { id: 'q1', options }, pendingChoice: null, answer: null, locked: false, disabled: false,
    onPick: (choice) => { state.pendingChoice = choice },
    onConfirm: (choice) => { calls.confirmed.push(choice); state.answer = choice; state.pendingChoice = null },
    onNext: () => { calls.next++ },
  }
  const press = (key, extra = {}) => {
    const event = { key, code: key === ' ' ? 'Space' : `Digit${key}`, preventDefault() { this.prevented = true }, ...extra }
    handleQuestionShortcut(event, state)
    return event
  }
  return { state, calls, press }
}

test('1–4 select A–D without recording an answer until Space', () => {
  const { state, calls, press } = fixture()
  for (const [key, letter] of [['1', 'A'], ['2', 'B'], ['3', 'C'], ['4', 'D']]) {
    assert.equal(press(key).prevented, true)
    assert.equal(state.pendingChoice, letter)
    assert.equal(calls.confirmed.length, 0)
  }
  press(' ')
  assert.deepEqual(calls.confirmed, ['D'])
  assert.equal(calls.next, 0)
  press(' ')
  assert.equal(calls.next, 1)
})

test('numeric listening options and number-pad keys map to their real option keys', () => {
  const { state, calls, press } = fixture({ 1: 'first', 2: 'second', 3: 'third' })
  press('2', { code: 'Numpad2' })
  assert.equal(state.pendingChoice, '2')
  press(' ')
  assert.deepEqual(calls.confirmed, ['2'])
  assert.equal(press('4').prevented, undefined)
})

test('Space without a choice does not answer or skip a question', () => {
  const { calls, press } = fixture()
  assert.equal(press(' ').prevented, true)
  assert.deepEqual(calls.confirmed, [])
  assert.equal(calls.next, 0)
})

test('holding a number or Space cannot repeatedly answer or advance', () => {
  const { state, calls, press } = fixture()
  press('1', { repeat: true })
  assert.equal(state.pendingChoice, null)
  press('1')
  press(' ', { repeat: true })
  assert.equal(calls.confirmed.length, 0)
  press(' ')
  press(' ', { repeat: true })
  assert.equal(calls.confirmed.length, 1)
  assert.equal(calls.next, 0)
})

test('typing in a form field or composing Japanese does not trigger shortcuts', () => {
  const { state, calls, press } = fixture()
  const target = { closest: (selector) => selector.startsWith('input,') ? {} : null }
  assert.equal(press('1', { target }).prevented, undefined)
  assert.equal(press(' ', { target }).prevented, undefined)
  press('1', { isComposing: true })
  assert.equal(state.pendingChoice, null)
  assert.equal(calls.confirmed.length, 0)
})

test('modifier shortcuts, handled events and inactive questions are left alone', () => {
  const { state, press } = fixture()
  for (const flag of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'defaultPrevented']) {
    assert.equal(press('1', { [flag]: true }).prevented, undefined)
    assert.equal(state.pendingChoice, null)
  }
  state.disabled = true
  assert.equal(press('1').prevented, undefined)
  assert.equal(press(' ').prevented, undefined)
})

test('Space preserves native unrelated-button behavior, including the submit button', () => {
  const { state, calls, press } = fixture()
  state.pendingChoice = 'B'
  const target = { closest: (selector) => selector === 'button, [role="button"]' ? {} : null }
  assert.equal(press(' ', { target }).prevented, undefined)
  assert.equal(calls.confirmed.length, 0)
  assert.equal(calls.next, 0)
})

test('focused answer buttons use the selected answer and suppress duplicate native Space clicks', () => {
  const { calls, press } = fixture()
  const target = { closest: (selector) => ['button, [role="button"]', '.answer-option'].includes(selector) ? {} : null }
  press('3', { target })
  assert.equal(press(' ', { target }).prevented, true)
  assert.deepEqual(calls.confirmed, ['C'])
})

test('practice answers stay locked while exam answers can be revised explicitly', () => {
  const { state, calls, press } = fixture()
  state.answer = 'A'
  state.locked = true
  press('2')
  assert.equal(state.pendingChoice, null)
  press(' ')
  assert.equal(calls.next, 1)
  state.locked = false
  press('2')
  press(' ')
  assert.deepEqual(calls.confirmed, ['B'])
})
