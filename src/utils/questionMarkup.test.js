import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renshuu3 } from '../data/renshuu3.js'
import { parseQuestionMarkup, plainQuestionText, questionInstruction } from './questionMarkup.js'

const awaitingReview = ['r3_q29', 'r3_q30', 'r3_q32', 'r3_q37', 'r3_q39', 'r3_q40', 'r3_q42']

test('hiển thị đúng phần được đánh dấu và đọc văn bản không có ký hiệu', () => {
  assert.deepEqual(parseQuestionMarkup('数学は得意ですが、英語は[[苦手]]です。'), [{ text: '数学は得意ですが、英語は', marked: false }, { text: '苦手', marked: true }, { text: 'です。', marked: false }])
  assert.equal(plainQuestionText('数学は[[苦手]]です。'), '数学は苦手です。')
  assert.equal(questionInstruction(renshuu3.find(q => q.id === 'r3_q6')), 'Chọn cách đọc của từ gạch chân')
  assert.equal(questionInstruction(renshuu3.find(q => q.id === 'r3_q26')), 'Chọn chữ kanji của từ gạch chân')
  assert.equal(questionInstruction(renshuu3.find(q => q.id === 'r3_q29')), 'Chọn đáp án đúng')
})

test('câu Kanji đã xác nhận có một cặp, đáp án hợp lệ và lựa chọn không trùng', () => {
  for (const q of renshuu3) {
    const marks = [...q.questionText.matchAll(/\[\[([^[\]]+)\]\]/g)]
    if (awaitingReview.includes(q.id)) assert.equal(marks.length, 0, q.id)
    else { assert.equal(marks.length, 1, q.id); assert.ok(!/\[\[|\]\]/.test(q.questionText.replace(marks[0][0], '')), q.id) }
    assert.ok(Object.hasOwn(q.options, q.correctAnswer), q.id)
    const values = Object.values(q.options).map(value => value.trim().normalize('NFKC'))
    assert.equal(new Set(values).size, values.length, q.id)
  }
  assert.deepEqual(renshuu3.filter(q => !/\[\[[^[\]]+\]\]/.test(q.questionText)).map(q => q.id), awaitingReview)
})

test('mọi câu Kanji có đúng một cặp gạch chân', { todo: '7 câu trong Word chưa có gạch chân, đang chờ người dùng duyệt' }, () => {
  for (const question of renshuu3) assert.equal((question.questionText.match(/\[\[[^[\]]+\]\]/g) || []).length, 1, question.id)
})
