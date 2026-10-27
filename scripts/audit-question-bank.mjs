import { QUIZ_SECTIONS, dokkai, choukai } from '../src/data/index.js'

const allPools = [...QUIZ_SECTIONS.map(section => [section.id, section.questions]), ['dokkai', dokkai.flatMap(item => item.questions)], ['choukai', Object.values(choukai).flat()]]
const missingMarks = QUIZ_SECTIONS.find(section => section.id === 'renshuu3').questions.filter(question => (question.questionText.match(/\[\[[^[\]]+\]\]/g) || []).length !== 1)
console.log(`Kanji thiếu một cặp ký hiệu: ${missingMarks.length}`)
for (const question of missingMarks) console.log(`${question.id}: ${question.questionText} | ${Object.entries(question.options).map(([key, value]) => `${key}: ${value}`).join(' · ')}`)
for (const [name, questions] of allPools) {
  const invalid = questions.filter(q => q.correctAnswer && !Object.hasOwn(q.options || {}, q.correctAnswer)).map(q => q.id)
  const duplicates = questions.filter(q => { const choices = Object.values(q.options || {}).map(value => String(value).trim().normalize('NFKC')); return choices.length > 0 && new Set(choices).size < choices.length }).map(q => q.id)
  const unknown = questions.filter(q => !q.correctAnswer).map(q => q.id)
  console.log(`${name}: ${questions.length} câu; đáp án không hợp lệ: ${invalid.join(', ') || 'không'}; lựa chọn trùng: ${duplicates.join(', ') || 'không'}; chưa có đáp án: ${unknown.length}${unknown.length ? ` (${unknown.join(', ')})` : ''}`)
}

if (process.argv.includes('--strict') && missingMarks.length) process.exitCode = 1
