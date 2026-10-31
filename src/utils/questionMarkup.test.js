import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renshuu3 } from '../data/renshuu3.js'
import { dokkai } from '../data/dokkai.js'
import { parseQuestionMarkup, plainQuestionText, questionInstruction } from './questionMarkup.js'

test('hiển thị đúng phần được đánh dấu và đọc văn bản không có ký hiệu', () => {
  assert.deepEqual(parseQuestionMarkup('数学は得意ですが、英語は[[苦手]]です。'), [{ text: '数学は得意ですが、英語は', marked: false }, { text: '苦手', marked: true }, { text: 'です。', marked: false }])
  assert.equal(plainQuestionText('数学は[[苦手]]です。'), '数学は苦手です。')
  assert.equal(questionInstruction(renshuu3.find(q => q.id === 'r3_q6')), 'Chọn cách đọc của từ gạch chân')
  assert.equal(questionInstruction(renshuu3.find(q => q.id === 'r3_q26')), 'Chọn chữ kanji của từ gạch chân')
  assert.equal(questionInstruction(renshuu3.find(q => q.id === 'r3_q29')), 'Chọn chữ kanji của từ gạch chân')
})

test('furigana chỉ áp dụng cho đoạn được chú thích và không thay đổi văn bản dùng để đọc', () => {
  assert.deepEqual(parseQuestionMarkup('ある{大学|だいがく}の{学長|がくちょう}です。'), [
    { text: 'ある', marked: false }, { text: '大学', reading: 'だいがく' }, { text: 'の', marked: false }, { text: '学長', reading: 'がくちょう' }, { text: 'です。', marked: false },
  ])
  assert.equal(plainQuestionText('ある{大学|だいがく}の{学長|がくちょう}です。'), 'ある大学の学長です。')
  assert.deepEqual(parseQuestionMarkup('授業中です。'), [{ text: '授業中です。', marked: false }])
  assert.deepEqual(parseQuestionMarkup('{未完成|}'), [{ text: '{未完成|}', marked: false }])
  assert.equal(plainQuestionText('数学は[[苦手]]、{漢字|かんじ}です。'), '数学は苦手、漢字です。')
  assert.equal(parseQuestionMarkup(dokkai[0].passage).filter(part => part.reading).length, 3)
  assert.ok(plainQuestionText(dokkai[0].passage).startsWith('みなさんのクラスは授業中静かですか。これはある大学の学長の話です。'))
})

test('mọi câu Kanji có đúng một cặp, đáp án hợp lệ và lựa chọn không trùng', () => {
  for (const q of renshuu3) {
    const marks = [...q.questionText.matchAll(/\[\[([^[\]]+)\]\]/g)]
    assert.equal(marks.length, 1, q.id)
    assert.ok(!/\[\[|\]\]/.test(q.questionText.replace(marks[0][0], '')), q.id)
    assert.ok(Object.hasOwn(q.options, q.correctAnswer), q.id)
    const values = Object.values(q.options).map(value => value.trim().normalize('NFKC'))
    assert.equal(new Set(values).size, values.length, q.id)
    if (q.part === 'B') assert.ok(values.includes(q.highlightWord.trim().normalize('NFKC')), q.id)
  }
  assert.deepEqual(renshuu3.filter(q => !/\[\[[^[\]]+\]\]/.test(q.questionText)).map(q => q.id), [])
})

test('bảy câu Part B giữ nguyên lựa chọn và dùng phần được duyệt', () => {
  const approved = {
    r3_q29: '誰も 彼の話を [[うたがわ]]なかった。',
    r3_q30: '喫茶店で コーヒーを [[ちゅうもん]]した。',
    r3_q32: 'クレジットカードの [[りょうしゅうしょ]] に サインをした。',
    r3_q37: '卒業後 一番[[しんぱい]]なことは 就職です。',
    r3_q39: 'サラダを 冷蔵庫で [[ひやして]] おきましょう。',
    r3_q40: '[[ざいりょう]] を はかりで 量りましょう。',
    r3_q42: '姉は 必要な[[しなもの]]の 名前を 紙に書いてくれた。',
  }
  for (const [id, text] of Object.entries(approved)) {
    const question = renshuu3.find(q => q.id === id)
    assert.equal(question.questionText, text)
    assert.ok(Object.values(question.options).includes(question.highlightWord), id)
  }
})
