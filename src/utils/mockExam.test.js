import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { allQuizQuestions, dokkai } from '../data/index.js'
import { createMockExam, getMockExamQuestions, getOverallStatus, getScoreStatus, gradeMockExam, parseManualScore, restoreMockExam, saveMockExamAttempt, serializeMockExam } from './mockExam.js'
import { getQuizHistory, getWrongQuestions, parseProgressBackup, setStorageUser } from './storage.js'
import { usableQuestion } from './questionUsability.js'

beforeEach(() => {
  setStorageUser('test-learner')
  const data = new Map()
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  }
})

const makeExam = () => createMockExam(() => .4)
const correctAnswers = (exam) => Object.fromEntries(getMockExamQuestions(exam)
  .filter((question) => Object.hasOwn(question.options, question.correctAnswer))
  .map((question) => [question.id, String(question.correctAnswer)]))

test('mock exams select exactly 35 questions, 2 passages, 30 listening questions and 1 writing topic', () => {
  const originalQuestions = allQuizQuestions.map((question) => question.id)
  const originalPassages = dokkai.map((passage) => passage.id)
  const exam = makeExam()
  assert.equal(exam.reading.length, 35)
  assert.equal(exam.passages.length, 2)
  assert.equal(exam.listening.length, 30)
  assert.ok(exam.writing.id)
  assert.equal(new Set(exam.reading.map((item) => item.id)).size, 35)
  assert.ok(exam.reading.every(usableQuestion))
  assert.ok(exam.passages.every(passage => passage.questions.every(usableQuestion)))
  assert.equal(exam.reading.some(item => item.id === 'r4_q35'), false)
  assert.equal(new Set(exam.passages.map((item) => item.id)).size, 2)
  assert.equal(new Set(exam.listening.map((item) => item.id)).size, 30)
  assert.deepEqual(allQuizQuestions.map((question) => question.id), originalQuestions)
  assert.deepEqual(dokkai.map((passage) => passage.id), originalPassages)
})

test('saved exams restore the same questions and reject missing or duplicated selections', () => {
  const exam = makeExam()
  const selection = serializeMockExam(exam)
  assert.deepEqual(serializeMockExam(restoreMockExam(selection)), selection)
  assert.equal(restoreMockExam({ ...selection, reading: [...selection.reading.slice(1), selection.reading[1]] }), null)
  assert.equal(restoreMockExam({ ...selection, writing: 'retired-topic' }), null)
})

test('each scored section passes at exactly 3 and fails below 3 without rounding', () => {
  assert.equal(getScoreStatus(3), 'passed')
  assert.equal(getScoreStatus(2.99), 'failed')
  assert.equal(getScoreStatus(2.99999), 'failed')
  assert.equal(getScoreStatus(null), 'pending')
  assert.equal(getOverallStatus([{ status: 'passed' }, { status: 'passed' }, { status: 'passed' }, { status: 'excluded' }]), 'passed')
  assert.equal(getOverallStatus([{ status: 'passed' }, { status: 'failed' }, { status: 'pending' }, { status: 'excluded' }]), 'failed')
})

test('unkeyed listening remains pending instead of receiving an invented score', () => {
  const exam = makeExam()
  const result = gradeMockExam(exam, correctAnswers(exam))
  assert.equal(result.sections.find((part) => part.id === 'reading').score, 10)
  assert.equal(result.sections.find((part) => part.id === 'passages').score, 10)
  const listening = result.sections.find((part) => part.id === 'listening')
  assert.equal(listening.status, 'pending')
  assert.equal(listening.score, null)
  assert.equal(result.status, 'pending')
  assert.equal(result.totalScore, null)
})

test('writing is excluded from scoring and cannot prevent a pass even when no text or writing score exists', () => {
  const exam = makeExam()
  const result = gradeMockExam(exam, correctAnswers(exam), { listening: 3, writing: 0 })
  const writing = result.sections.find((part) => part.id === 'writing')
  assert.equal(writing.status, 'excluded')
  assert.equal(writing.score, null)
  assert.equal(writing.maxScore, null)
  assert.equal(writing.manual, false)
  assert.equal(result.status, 'passed')
  assert.equal(result.maxScore, 30)
  assert.equal(result.totalScore, 23)
})

test('one section below 3 fails the whole exam despite high marks in other sections', () => {
  const exam = makeExam()
  const result = gradeMockExam(exam, correctAnswers(exam), { listening: 2.99 })
  assert.equal(result.status, 'failed')
  assert.equal(result.sections.find((part) => part.id === 'listening').status, 'failed')
  assert.equal(gradeMockExam(exam, {}, { listening: 10 }).status, 'failed')
})

test('manual scores reject blanks, non-numeric values and values outside 0–10', () => {
  for (const value of ['', ' ', undefined, null, NaN, Infinity, -1, 10.01, 'abc']) assert.equal(parseManualScore(value), null)
  assert.equal(parseManualScore(0), 0)
  assert.equal(parseManualScore('3'), 3)
  assert.equal(parseManualScore('2,99'), 2.99)
  assert.equal(parseManualScore(10), 10)
})

test('updating a listening score updates the original history entry without counting mistakes twice', () => {
  const exam = makeExam()
  const question = exam.reading[0]
  const wrong = Object.keys(question.options).find((letter) => String(letter) !== String(question.correctAnswer))
  const answers = { [question.id]: wrong }
  const first = saveMockExamAttempt(exam, answers, '私の作文です。', 120)
  const updated = saveMockExamAttempt(exam, answers, '私の作文です。', 120, { listening: 3 })
  assert.equal(getQuizHistory().length, 1)
  assert.equal(getWrongQuestions()[question.section][question.id].count, 1)
  assert.equal(updated.date, first.date)
  assert.equal(updated.writingText, '私の作文です。')
  assert.equal(updated.sections.find((part) => part.id === 'listening').score, 3)
  assert.equal(updated.sections.find((part) => part.id === 'writing').status, 'excluded')
})

test('progress backups preserve structured exam results and reject malformed section scores', () => {
  const exam = makeExam()
  const saved = saveMockExamAttempt(exam, correctAnswers(exam), '', 95, { listening: 3 })
  const backup = { version: 1, data: { n3vjit_quizHistory: [saved] } }
  assert.equal(parseProgressBackup(JSON.stringify(backup))[0][1][0].status, 'passed')
  saved.sections[0].score = 11
  assert.throws(() => parseProgressBackup(JSON.stringify(backup)))
})
