import { allQuizQuestions, dokkai, choukai, kaiwaSakubun } from '../data/index.js'
import { gradeExam } from './learning.js'
import { addWrongQuestion, getQuizHistory, markDokkaiCompleted, markQuestionCompleted, markWrongQuestionCorrect, saveQuizAttempt } from './storage.js'
import { createId } from './id.js'

export const EXAM_PASS_SCORE = 3
export const EXAM_MAX_SCORE = 10
export const MOCK_EXAM_PARTS = [
  { id: 'reading', label: 'Đọc hiểu', amount: 35, unit: 'câu' },
  { id: 'passages', label: 'Bài đọc văn', amount: 2, unit: 'bài' },
  { id: 'listening', label: 'Nghe', amount: 30, unit: 'câu' },
  { id: 'writing', label: 'Viết', amount: 1, unit: 'bài' },
]

export const listeningBank = Object.entries(choukai).flatMap(([group, questions]) => questions.map((question) => ({
  ...question,
  section: question.section || group,
  questionText: question.questionText || question.situation || question.prompt || `Nghe và chọn câu trả lời phù hợp (${question.n || question.questionNumber}).`,
})))

function sample(items, count, random) {
  if (items.length < count) throw new Error('Ngân hàng chưa đủ câu hỏi cho cấu trúc đề này.')
  const pool = [...items]
  for (let index = pool.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[pool[index], pool[other]] = [pool[other], pool[index]]
  }
  return pool.slice(0, count)
}

export function createMockExam(random = Math.random) {
  return {
    id: createId(),
    reading: sample(allQuizQuestions, 35, random),
    passages: sample(dokkai, 2, random),
    listening: sample(listeningBank, 30, random),
    writing: sample(kaiwaSakubun.sakubun, 1, random)[0],
  }
}

export function serializeMockExam(exam) {
  return {
    id: exam.id,
    reading: exam.reading.map((question) => question.id),
    passages: exam.passages.map((passage) => passage.id),
    listening: exam.listening.map((question) => question.id),
    writing: exam.writing.id,
  }
}

export function restoreMockExam(selection) {
  if (!selection || typeof selection.id !== 'string') return null
  const select = (ids, bank, count) => {
    if (!Array.isArray(ids) || ids.length !== count || new Set(ids).size !== count) return null
    const items = ids.map((id) => bank.find((item) => item.id === id))
    return items.every(Boolean) ? items : null
  }
  const reading = select(selection.reading, allQuizQuestions, 35)
  const passages = select(selection.passages, dokkai, 2)
  const listening = select(selection.listening, listeningBank, 30)
  const writing = kaiwaSakubun.sakubun.find((topic) => topic.id === selection.writing)
  return reading && passages && listening && writing ? { id: selection.id, reading, passages, listening, writing } : null
}

export function parseManualScore(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && value.trim() === '') return null
  const score = Number(typeof value === 'string' ? value.replace(',', '.') : value)
  return Number.isFinite(score) && score >= 0 && score <= EXAM_MAX_SCORE ? score : null
}

export function getScoreStatus(score) {
  return score === null ? 'pending' : score < EXAM_PASS_SCORE ? 'failed' : 'passed'
}

export function getOverallStatus(parts) {
  if (parts.some((part) => part.status === 'failed')) return 'failed'
  if (parts.some((part) => part.status === 'pending')) return 'pending'
  return 'passed'
}

export function getMockExamQuestions(exam) {
  return [
    ...exam.reading,
    ...exam.passages.flatMap((passage) => passage.questions.map((question) => ({ ...question, section: question.section || passage.id }))),
    ...exam.listening,
  ]
}

export function gradeMockExam(exam, answers, manualScores = {}) {
  const groups = {
    reading: exam.reading,
    passages: exam.passages.flatMap((passage) => passage.questions),
    listening: exam.listening,
    writing: [],
  }
  const sections = MOCK_EXAM_PARTS.map((part) => {
    const questions = groups[part.id]
    const known = questions.filter((question) => Object.hasOwn(question.options, question.correctAnswer))
    const excluded = part.id === 'writing'
    const manual = !excluded && known.length !== questions.length
    const stats = gradeExam(questions, answers)
    const correct = gradeExam(known, answers).correct
    const score = excluded ? null : manual ? parseManualScore(manualScores[part.id]) : correct / questions.length * EXAM_MAX_SCORE
    return { ...part, ...stats, correct, knownAnswers: known.length, score, maxScore: excluded ? null : EXAM_MAX_SCORE, status: excluded ? 'excluded' : getScoreStatus(score), manual }
  })
  const stats = gradeExam(getMockExamQuestions(exam), answers)
  const scored = sections.filter((part) => part.status !== 'excluded')
  return { ...stats, sections, status: getOverallStatus(sections), totalScore: scored.some((part) => part.score === null) ? null : scored.reduce((total, part) => total + part.score, 0), maxScore: scored.length * EXAM_MAX_SCORE }
}

export function saveMockExamAttempt(exam, answers, writingText, elapsed, manualScores = {}) {
  const previous = getQuizHistory().find((attempt) => attempt.id === exam.id)
  if (!previous) {
    for (const question of getMockExamQuestions(exam)) {
      const choice = answers[question.id]
      if (!Object.hasOwn(question.options, choice)) continue
      markQuestionCompleted(question.section, question.id)
      if (!Object.hasOwn(question.options, question.correctAnswer)) continue
      if (String(choice) === String(question.correctAnswer)) markWrongQuestionCorrect(question.section, question.id)
      else addWrongQuestion(question.section, question.id)
    }
    for (const passage of exam.passages) {
      if (passage.questions.every((question) => Object.hasOwn(question.options, answers[question.id]))) markDokkaiCompleted(passage.id)
    }
  }
  const result = {
    ...gradeMockExam(exam, answers, manualScores),
    id: exam.id,
    mode: 'mock-exam',
    exam: serializeMockExam(exam),
    answers,
    writingText,
    elapsed,
    manualScores,
  }
  return saveQuizAttempt(result)
}
