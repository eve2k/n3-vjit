import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleStudyShortcut, shouldIgnoreStudyShortcut } from './studyShortcuts.js'
const event = (key, extra = {}) => ({ key, code: '', preventDefault() { this.prevented = true }, ...extra })

test('chọn đáp án bằng số thường và numpad, không lặp', () => {
  const picked = []
  const state = { mode: 'study', optionCount: 4, onChoose: index => picked.push(index) }
  handleStudyShortcut(event('1'), state, 1000)
  handleStudyShortcut(event('End', { code: 'Numpad4' }), state, 1000)
  handleStudyShortcut(event('2', { repeat: true }), state, 1000)
  assert.deepEqual(picked, [0, 3])
})
test('Enter và Space chỉ chuyển sau 500ms và chặn hành vi mặc định khi khóa', () => {
  let next = 0
  const state = { mode: 'study', answered: true, answeredAt: 1000, onAdvance: () => next++ }
  const early = event('Enter')
  assert.equal(handleStudyShortcut(early, state, 1499), true)
  assert.equal(early.prevented, true)
  assert.equal(next, 0)
  handleStudyShortcut(event(' ', { code: 'Space' }), state, 1500)
  assert.equal(next, 1)
})
test('bỏ qua ô nhập, contenteditable, tổ hợp phím và IME', () => {
  for (const e of [event('1', { target: { closest: () => ({}) } }), event('s', { target: { isContentEditable: true } }), event('1', { ctrlKey: true }), event('1', { altKey: true }), event('1', { metaKey: true }), event('1', { isComposing: true }), event('1', { repeat: true })]) assert.equal(shouldIgnoreStudyShortcut(e), true)
})
test('phím xem trước và trợ giúp không ghi đè hành động nút khác', () => {
  let started = 0, back = 0, help = 0
  const state = { mode: 'preview', onStart: () => started++, onExit: () => back++, onHelp: () => help++ }
  handleStudyShortcut(event('Enter', { target: { closest: selector => selector.startsWith('button') ? {} : null } }), state)
  handleStudyShortcut(event('Enter'), state)
  handleStudyShortcut(event('Escape'), state)
  handleStudyShortcut(event('?', { shiftKey: true }), state)
  assert.deepEqual([started, back, help], [1, 1, 1])
})

test('Space tiếp tục vòng học dở kể cả khi nút chính được focus', () => {
  let started = 0, exited = 0
  const state = { mode: 'preview', startOnSpace: true, onStart: () => started++, onExit: () => exited++ }
  handleStudyShortcut(event(' '), state)
  const primary = event(' ', { target: { closest: selector => selector.startsWith('button') || selector === '[data-shortcut-start]' ? {} : null } })
  handleStudyShortcut(primary, state)
  assert.equal(primary.prevented, true)
  handleStudyShortcut(event(' ', { target: { closest: selector => selector.startsWith('button') ? {} : null } }), state)
  handleStudyShortcut(event(' ', { target: { closest: selector => selector.startsWith('input') ? {} : null } }), state)
  handleStudyShortcut(event('Enter'), state)
  handleStudyShortcut(event('Escape'), state)
  assert.deepEqual([started, exited], [3, 1])
})

test('phím giữ trên nút tiếp tục không gây kích hoạt mặc định', () => {
  let next = 0
  const e = event('Enter', { repeat: true, target: { closest: selector => selector === '[data-shortcut-advance]' ? {} : null } })
  handleStudyShortcut(e, { answered: true, answeredAt: 1000, onAdvance: () => next++ }, 2000)
  assert.equal(e.prevented, true)
  assert.equal(next, 0)
})

test('phím phát âm và Esc trong trợ giúp thực hiện đúng hành động', () => {
  let speak = 0, exit = 0, help = 0
  const state = { mode: 'study', onSpeak: () => speak++, onExit: () => exit++, onHelp: () => help++ }
  handleStudyShortcut(event('s'), state)
  handleStudyShortcut(event('Escape'), { ...state, helpOpen: true })
  assert.deepEqual([speak, exit, help], [1, 0, 1])
})
