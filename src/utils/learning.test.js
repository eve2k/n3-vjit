import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { allQuizQuestions, quizSections, dokkai } from '../data/index.js'
import { getContinueLesson, getMistakeQuestions, getQuizProgress, getSectionProgress, gradeExam, reviewQuestions } from './learning.js'
import { recordExamAttempt } from './exam.js'
import { getCompletedQuestions, getQuizHistory, getWrongQuestions, importProgress, parseProgressBackup } from './storage.js'

beforeEach(() => {
  const data = new Map()
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  }
  globalThis.FileReader = class {
    readAsText(file) { this.onload({ target: { result: file.text } }) }
  }
})

test('quiz progress excludes reading/listening, duplicates and retired IDs', () => {
  const section = quizSections[0]
  const completed = {
    [section.id]: [section.questions[0].id, section.questions[0].id, 'retired-question'],
    dokkai1: ['reading-question'],
    mondai4: ['listening-question'],
  }
  assert.equal(getQuizProgress(completed), 1)
  assert.equal(getSectionProgress(section, completed), 1)
  const all = Object.fromEntries(quizSections.map((item) => [item.id, item.questions.map((question) => question.id)]))
  assert.equal(getQuizProgress(all), allQuizQuestions.length)
})

test('continue lesson resumes the saved unfinished question in its section', () => {
  const section = quizSections[2]
  const question = section.questions[8]
  assert.equal(getContinueLesson({}, { sectionId: section.id, questionId: question.id }).question.id, question.id)
  const completed = { [section.id]: [question.id] }
  assert.equal(getContinueLesson(completed, { sectionId: section.id, questionId: question.id }).question.id, section.questions[0].id)
})

test('continue lesson advances after a completed section and ends at full completion', () => {
  const completed = Object.fromEntries(quizSections.map((section) => [section.id, section.questions.map((question) => question.id)]))
  assert.equal(getContinueLesson(completed), null)
  delete completed[quizSections[3].id]
  assert.equal(getContinueLesson(completed, { sectionId: quizSections[0].id }).section.id, quizSections[3].id)
  assert.equal(getContinueLesson({}, { sectionId: 'deleted-section' }).question.id, allQuizQuestions[0].id)
})

test('mistake review includes reading context and listening questions', () => {
  const reading = reviewQuestions.find((question) => question.id === dokkai[0].questions[0].id)
  const listening = reviewQuestions.find((question) => question.contextTitle === 'Luyện nghe')
  assert.ok(reading.passageText)
  assert.ok(listening.questionText)
  const wrong = {}
  for (const question of [reading, listening]) {
    wrong[question.section] ??= {}
    wrong[question.section][question.id] = { count: 1, correctStreak: 0 }
  }
  const result = getMistakeQuestions(wrong)
  assert.equal(result.length, 2)
  assert.ok(result.some((question) => question.id === reading.id))
  assert.ok(result.some((question) => question.id === listening.id))
})

test('grading distinguishes valid, wrong, skipped and invalid answers', () => {
  const questions = allQuizQuestions.slice(0, 4)
  const wrong = Object.keys(questions[1].options).find((letter) => letter !== questions[1].correctAnswer)
  const answers = { [questions[0].id]: questions[0].correctAnswer, [questions[1].id]: wrong, [questions[3].id]: 'INVALID' }
  assert.deepEqual(gradeExam(questions, answers), { total: 4, answered: 2, unanswered: 2, correct: 1 })
})

test('submitting an exam saves only answered questions and records its duration', () => {
  const questions = allQuizQuestions.slice(0, 3)
  const wrong = Object.keys(questions[1].options).find((letter) => letter !== questions[1].correctAnswer)
  const result = recordExamAttempt(questions, { [questions[0].id]: questions[0].correctAnswer, [questions[1].id]: wrong }, 85)
  assert.equal(result.unanswered, 1)
  assert.equal(result.correct, 1)
  assert.deepEqual(getCompletedQuestions()[questions[0].section], [questions[0].id, questions[1].id])
  assert.deepEqual(Object.keys(getWrongQuestions()[questions[1].section]), [questions[1].id])
  assert.equal(getQuizHistory().length, 1)
  assert.equal(getQuizHistory()[0].elapsed, 85)
})

test('an entirely blank exam does not create completed questions or mistakes', () => {
  recordExamAttempt(allQuizQuestions.slice(0, 50), {}, 10)
  assert.deepEqual(getCompletedQuestions(), {})
  assert.deepEqual(getWrongQuestions(), {})
  assert.equal(getQuizHistory()[0].unanswered, 50)
})

test('backup parser accepts the previous format and the versioned format', () => {
  const data = { n3vjit_completedQuestions: { fukushuu1: ['f1_q1'] }, n3vjit_theme: 'yorha' }
  assert.deepEqual(parseProgressBackup(JSON.stringify(data)), Object.entries(data))
  assert.deepEqual(parseProgressBackup(JSON.stringify({ version: 1, data })), Object.entries(data))
})

test('backup parser ignores unrelated storage keys and rejects malformed known values', () => {
  assert.deepEqual(parseProgressBackup(JSON.stringify({ n3vjit_theme: 'modern', unrelatedToken: 'ignored' })), [['n3vjit_theme', 'modern']])
  assert.throws(() => parseProgressBackup('{"unrelatedToken":"ignored"}'))
  assert.throws(() => parseProgressBackup('{"n3vjit_completedQuestions":{"fukushuu1":"bad"}}'))
  assert.throws(() => parseProgressBackup('{"n3vjit_wrongQuestions":{"fukushuu1":{"q":null}}}'))
  assert.throws(() => parseProgressBackup('{"version":2,"data":{"n3vjit_theme":"modern"}}'))
  assert.throws(() => parseProgressBackup('null'))
})

test('invalid backups are validated fully before any existing progress is replaced', async () => {
  localStorage.setItem('n3vjit_theme', '"yorha"')
  await assert.rejects(importProgress({ text: JSON.stringify({ n3vjit_theme: 'modern', n3vjit_masteredFlashcards: 'invalid' }) }))
  assert.equal(localStorage.getItem('n3vjit_theme'), '"yorha"')
})

test('restore rolls back previous changes if browser storage refuses a write', async () => {
  localStorage.setItem('n3vjit_theme', '"yorha"')
  const write = localStorage.setItem
  let shouldFail = true
  localStorage.setItem = (key, value) => {
    if (key === 'n3vjit_masteredFlashcards' && shouldFail) { shouldFail = false; throw new Error('Quota exceeded') }
    write(key, value)
  }
  await assert.rejects(importProgress({ text: JSON.stringify({ n3vjit_theme: 'modern', n3vjit_masteredFlashcards: ['card1'] }) }))
  assert.equal(localStorage.getItem('n3vjit_theme'), '"yorha"')
  assert.equal(localStorage.getItem('n3vjit_masteredFlashcards'), null)
})

test('restore reads valid progress and leaves unrelated browser data untouched', async () => {
  localStorage.setItem('unrelated', 'keep')
  await importProgress({ text: JSON.stringify({ version: 1, data: { n3vjit_completedQuestions: { fukushuu1: ['f1_q1'] }, unrelated: 'replace' } }) })
  assert.deepEqual(getCompletedQuestions(), { fukushuu1: ['f1_q1'] })
  assert.equal(localStorage.getItem('unrelated'), 'keep')
})

test('restore reports a readable error when the selected file cannot be read', async () => {
  globalThis.FileReader = class {
    readAsText() { this.onerror({ type: 'error' }) }
  }
  await assert.rejects(importProgress({}), { message: 'Không đọc được tệp sao lưu.' })
})
