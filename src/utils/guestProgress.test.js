import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { addQuizResult, addWrongQuestion, exportProgress, getCompletedQuestions, getCustomSakubun, getDokkaiProgress, getLastLesson, getMasteredFlashcards, getPomodoroLearning, getQuizHistory, getTheme, getUserProfile, getWrongQuestions, importProgress, markDokkaiCompleted, markQuestionCompleted, markWrongQuestionCorrect, readProgressSnapshot, resetAllProgress, saveCustomSakubun, saveLastLesson, savePomodoroLearning, saveQuizAttempt, saveUserProfile, setStorageUser, setTheme, toggleFlashcardMastered, writeProgressSnapshot } from './storage.js'

let data
beforeEach(() => {
  data = new Map()
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
  setStorageUser(null)
})

test('guest practice never writes learning data or history to browser storage', () => {
  markQuestionCompleted('section', 'question')
  addWrongQuestion('section', 'question')
  markWrongQuestionCorrect('section', 'question')
  toggleFlashcardMastered('card')
  saveCustomSakubun('essay', 'Guest essay')
  saveUserProfile({ name: 'Guest' })
  saveLastLesson('section', 'question')
  markDokkaiCompleted('passage')
  addQuizResult({ total: 1, correct: 1 })
  savePomodoroLearning({ cycles: [], events: [] })
  const transient = saveQuizAttempt({ id: 'guest-exam', total: 1, correct: 1 })
  assert.equal(transient.id, 'guest-exam')
  assert.equal(data.size, 0)
  assert.deepEqual(getPomodoroLearning(), { cycles: [], events: [] })
  assert.deepEqual(getCompletedQuestions(), {})
  assert.deepEqual(getWrongQuestions(), {})
  assert.deepEqual(getMasteredFlashcards(), [])
  assert.deepEqual(getCustomSakubun(), {})
  assert.deepEqual(getDokkaiProgress(), {})
  assert.deepEqual(getQuizHistory(), [])
  assert.equal(getLastLesson(), null)
  assert.equal(getUserProfile().name, '')
})

test('signed-in Pomodoro events are scoped into snapshots for sync and backup', () => {
  setStorageUser('learner')
  const progress = { cycles: [{ id: 'round', startedAt: '2026-01-01T00:00:00.000Z', completedAt: null }], events: [{ id: 'event', unitId: 'unit', cycleId: 'round', contentType: 'quiz', correct: true, at: '2026-01-01T00:01:00.000Z', dueAtStep: 6 }] }
  savePomodoroLearning(progress)
  assert.deepEqual(getPomodoroLearning(), progress)
  assert.deepEqual(readProgressSnapshot('learner').n3vjit_pomodoroLearning, progress)
})

test('legacy guest data is ignored and never appears in a signed-in account', () => {
  localStorage.setItem('n3vjit_completedQuestions', '{"section":["legacy"]}')
  localStorage.setItem('n3vjit_quizHistory', '[{"total":1,"correct":1,"date":"2026-10-26"}]')
  assert.deepEqual(getCompletedQuestions(), {})
  assert.deepEqual(getQuizHistory(), [])
  assert.deepEqual(readProgressSnapshot(null), {})
  setStorageUser('learner')
  assert.deepEqual(getCompletedQuestions(), {})
  markQuestionCompleted('section', 'signed-in-question')
  setStorageUser(null)
  assert.deepEqual(getCompletedQuestions(), {})
  setStorageUser('learner')
  assert.deepEqual(getCompletedQuestions(), { section: ['signed-in-question'] })
})

test('guests cannot bypass the policy through backups or snapshots', async () => {
  assert.throws(() => exportProgress(), /Đăng nhập/)
  await assert.rejects(importProgress({}), /Đăng nhập/)
  assert.throws(() => writeProgressSnapshot({ n3vjit_masteredFlashcards: ['card'] }), /Đăng nhập/)
  assert.equal(data.size, 0)
})

test('guest appearance preference is independent of learning data and account progress', () => {
  setStorageUser('learner')
  markQuestionCompleted('section', 'question')
  setStorageUser(null)
  setTheme('dark')
  assert.equal(getTheme(), 'dark')
  resetAllProgress()
  assert.equal(getTheme(), 'dark')
  setStorageUser('learner')
  assert.deepEqual(getCompletedQuestions(), { section: ['question'] })
})
