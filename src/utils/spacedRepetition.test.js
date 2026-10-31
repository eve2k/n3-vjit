import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { allQuizQuestions } from '../data/index.js'
import { buildStudyPlan, newerSrsRecord, scheduleReview, SRS_INTERVALS, srsKey, studyDay, validSrsRecord } from './spacedRepetition.js'
import { calculateRoadmap, defaultExamDate, effectiveReviewDue, forecastStudyDays, mergeStudyRoadmaps, plannedExamSessions, consolidationStudyDates, validDay, validStudyRoadmap } from './studyRoadmap.js'
import { addWrongQuestion, ensureStudyRoadmap, getCompletedQuestions, getSpacedRepetition, getStudyRoadmap, markQuestionCompleted, parseProgressBackup, readProgressSnapshot, recordSpacedAnswer, resetAllProgress, saveMasteryProgress, saveStudyExamDate, setStorageUser, writeProgressSnapshot } from './storage.js'
import { reconcileProgress } from './syncProgress.js'

const DAY = 86400000
const NOW = Date.parse('2026-10-26T03:00:00Z')
const pool = count => Array.from({ length: count }, (_, i) => ({ id: `q${i}`, section: `s${i % 5}`, options: { A: 'correct', B: 'wrong' }, correctAnswer: 'A' }))
const plan = (examDate = '2026-11-21') => ({ startDate: '2026-10-26', examDate, customExam: true, updatedAt: new Date(NOW).toISOString() })
const review = (previous = null, correct = true, now = NOW, extra = {}) => scheduleReview(previous, correct, { now, reviewId: `attempt-${now}`, ...extra })
let data
beforeEach(() => {
  data = new Map()
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
  setStorageUser('learner')
})

test('correct due reviews expand 1, 3, 7, 14, 30, 60 days then remain capped', () => {
  let record = null
  let now = NOW
  for (const interval of [...SRS_INTERVALS, 60]) {
    record = review(record, true, now)
    assert.equal(Date.parse(record.dueAt) - now, interval * DAY)
    assert.ok(validSrsRecord(record))
    now = Date.parse(record.dueAt)
  }
  assert.equal(record.stage, 6)
  assert.equal(record.reviews, 7)
})

test('a lapse resets the interval to ten minutes; correct relearning returns to one day', () => {
  const learned = review()
  const wrong = review(learned, false, NOW + 60000)
  assert.equal(wrong.stage, 0)
  assert.equal(wrong.lapses, 1)
  assert.equal(wrong.correctStreak, 0)
  assert.equal(Date.parse(wrong.dueAt), NOW + 11 * 60000)
  const recovered = review(wrong, true, Date.parse(wrong.dueAt))
  assert.equal(recovered.stage, 1)
  assert.equal(Date.parse(recovered.dueAt) - Date.parse(wrong.dueAt), DAY)
})

test('early correct answers, duplicate callbacks and backwards clocks do not advance reviews', () => {
  const record = review()
  assert.equal(review(record, true, NOW + 1000), record)
  assert.equal(review(record, false, NOW + 1000, { reviewId: record.lastReviewId }), record)
  assert.equal(review(record, false, NOW - 1000), record)
})

test('a session prioritizes overdue reviews, excludes future cards, and is capped at twenty', () => {
  const questions = pool(40)
  const records = Object.fromEntries(questions.slice(0, 25).map((q, i) => [srsKey(q), review(null, true, NOW - (i + 2) * DAY)]))
  records[srsKey(questions[25])] = review()
  const session = buildStudyPlan(questions, records, {}, { now: NOW })
  assert.equal(session.questions.length, 20)
  assert.equal(session.reviewCount, 20)
  assert.equal(session.newCount, 0)
  assert.equal(session.dueCount, 25)
  assert.equal(session.questions[0].id, 'q24')
  assert.ok(!session.questions.includes(questions[25]))
})

test('new material is balanced across sections and never repeats within a session', () => {
  const questions = Array.from({ length: 5 }, (_, section) => pool(20).map((q, i) => ({ ...q, section: `s${section}`, id: `s${section}-q${i}` }))).flat()
  const session = buildStudyPlan(questions, {}, {}, { now: NOW })
  assert.equal(session.newCount, 10)
  assert.equal(new Set(session.questions.map(srsKey)).size, 10)
  for (let i = 0; i < 5; i++) assert.equal(session.questions.filter(q => q.section === `s${i}`).length, 2)
  assert.equal(new Set(allQuizQuestions.map(q => q.id)).size, allQuizQuestions.length)
})

test('the daily allowance is shared across sections and resets at Vietnam midnight', () => {
  const questions = pool(30)
  const records = Object.fromEntries(questions.slice(0, 10).map(q => [srsKey(q), review()]))
  assert.equal(buildStudyPlan(questions, records, {}, { now: NOW, sectionId: 's1' }).newCount, 0)
  assert.equal(studyDay(Date.parse('2026-10-26T16:59:59Z')), '2026-10-26')
  assert.equal(studyDay(Date.parse('2026-10-26T17:00:00Z')), '2026-10-27')
  const nextDay = buildStudyPlan(questions, records, {}, { now: Date.parse('2026-10-26T17:00:00Z') })
  assert.equal(nextDay.newToday, 0)
  assert.equal(nextDay.newCount, 10)
})

test('previously completed questions become reviews without assuming mastery or consuming new quota', () => {
  const questions = pool(4)
  const completed = { s0: ['q0'] }
  const session = buildStudyPlan(questions, {}, completed, { now: NOW })
  assert.equal(session.reviewCount, 1)
  assert.equal(session.newCount, 3)
  markQuestionCompleted('s0', 'q0')
  const record = recordSpacedAnswer(questions[0], true, { now: NOW, reviewId: 'legacy-review' })
  assert.equal(record.introducedOn, null)
  assert.equal(record.stage, 1)
})

test('a first ordinary answer counts once today, while retries and later visits keep its original day', () => {
  const question = pool(1)[0]
  const first = recordSpacedAnswer(question, true, { now: NOW, reviewId: 'first' })
  assert.equal(first.introducedOn, '2026-10-26')
  assert.equal(first.dueAt, new Date(NOW + DAY).toISOString())
  assert.equal(buildStudyPlan([question], getSpacedRepetition(), getCompletedQuestions(), { now: NOW }).newToday, 1)
  markQuestionCompleted(question.section, question.id)
  assert.deepEqual(recordSpacedAnswer(question, true, { now: NOW + 1000, reviewId: 'first' }), first)
  const retry = recordSpacedAnswer(question, false, { now: NOW + 2000, reviewId: 'retry' })
  assert.equal(retry.introducedOn, first.introducedOn)
  assert.equal(retry.dueAt, new Date(NOW + 2000 + 10 * 60000).toISOString())
  assert.equal(buildStudyPlan([question], getSpacedRepetition(), getCompletedQuestions(), { now: Date.parse('2026-10-26T16:59:59Z') }).newToday, 1)
  assert.equal(buildStudyPlan([question], getSpacedRepetition(), getCompletedQuestions(), { now: Date.parse('2026-10-26T17:00:00Z') }).newToday, 0)
  const revisit = recordSpacedAnswer(question, false, { now: NOW + DAY, reviewId: 'revisit' })
  assert.equal(revisit.introducedOn, first.introducedOn)
  assert.equal(revisit.reviews, 3)
  assert.equal(buildStudyPlan([question], getSpacedRepetition(), getCompletedQuestions(), { now: NOW + DAY }).newToday, 0)
})

test('a mastery card encountered before SRS tracking is never introduced again', () => {
  const question = pool(1)[0]
  saveMasteryProgress({ cards: { [srsKey(question)]: { level: 1, lastResult: 'correct', updatedAt: new Date(NOW - DAY).toISOString(), updateId: 'old' } }, nodes: {} })
  const record = recordSpacedAnswer(question, true, { now: NOW, reviewId: 'old-lesson' })
  assert.equal(record.introducedOn, null)
  assert.equal(buildStudyPlan([question], getSpacedRepetition(), {}, { now: NOW }).newToday, 0)
})

test('a question previously missed outside quiz is a review, not a first introduction', () => {
  const question = pool(1)[0]
  addWrongQuestion(question.section, question.id)
  assert.equal(recordSpacedAnswer(question, false, { now: NOW, reviewId: 'old-mistake' }).introducedOn, null)
})

test('future schedules leave an empty session with the next review timestamp', () => {
  const questions = pool(1)
  const record = review()
  const session = buildStudyPlan(questions, { [srsKey(questions[0])]: record }, {}, { now: NOW })
  assert.equal(session.questions.length, 0)
  assert.equal(session.nextDueAt, record.dueAt)
})

test('the roadmap reserves a final review period and divides the remaining bank by available days', () => {
  const roadmap = calculateRoadmap(plan(), { today: '2026-10-26', unseenCount: 190, newToday: 0, dueCount: 15 })
  assert.equal(roadmap.daysLeft, 26)
  assert.equal(roadmap.consolidationDays, 7)
  assert.equal(roadmap.consolidationStart, '2026-11-14')
  assert.equal(roadmap.learningDaysLeft, 19)
  assert.equal(roadmap.dailyNewTarget, 10)
  assert.equal(roadmap.sessionsToday, 2)
})

test('daily targets stay stable as answers are saved and recalculate after missed days', () => {
  const before = calculateRoadmap(plan(), { today: '2026-10-26', unseenCount: 190, newToday: 0 })
  const during = calculateRoadmap(plan(), { today: '2026-10-26', unseenCount: 184, newToday: 6 })
  assert.equal(during.dailyNewTarget, before.dailyNewTarget)
  assert.equal(during.newRemainingToday, 4)
  const missed = calculateRoadmap(plan(), { today: '2026-10-30', unseenCount: 190, newToday: 0 })
  assert.equal(missed.dailyNewTarget, 13)
})

test('short deadlines require multiple small sessions rather than silently limiting coverage to ten', () => {
  const session = buildStudyPlan(pool(200), {}, {}, { now: NOW, studyPlan: plan('2026-10-28') })
  assert.equal(session.dailyLimit, 200)
  assert.equal(session.newCount, 20)
  assert.equal(session.roadmap.sessionsToday, 10)
  assert.equal(session.roadmap.consolidationDays, 0)
})

test('finishing the calculated daily quota prevents extra new material in repeated sessions', () => {
  const questions = pool(190)
  const records = Object.fromEntries(questions.slice(0, 10).map(q => [srsKey(q), review(null, true, NOW, { studyPlan: plan() })]))
  const session = buildStudyPlan(questions, records, {}, { now: NOW, studyPlan: plan() })
  assert.equal(session.dailyLimit, 10)
  assert.equal(session.newCount, 0)
  assert.equal(session.questions.length, 0)
})

test('late learners can catch up during consolidation; exam day introduces no new questions', () => {
  const late = calculateRoadmap(plan(), { today: '2026-11-19', unseenCount: 20, newToday: 0 })
  assert.equal(late.phase, 'consolidation')
  assert.equal(late.catchingUp, true)
  assert.equal(late.dailyNewTarget, 0)
  assert.equal(late.todayEvent.kind, 'correction')
  assert.equal(calculateRoadmap(plan(), { today: '2026-11-20', unseenCount: 20, newToday: 0 }).dailyNewTarget, 20)
  const exam = calculateRoadmap(plan(), { today: '2026-11-21', unseenCount: 20, newToday: 0 })
  assert.equal(exam.dailyNewTarget, 0)
  assert.equal(exam.daysLeft, 0)
  assert.equal(calculateRoadmap(plan(), { today: '2026-11-22', unseenCount: 20, newToday: 0 }).examPassed, true)
})

test('final consolidation is spread across non-exam days and a completed checkpoint is not repeated', () => {
  const p = { ...plan('2026-11-01'), startDate: '2026-10-01' }
  const record = { ...review(), dueAt: '2026-12-25T03:00:00Z', lastReviewedAt: '2026-10-10T03:00:00Z', firstReviewedAt: '2026-10-10T03:00:00Z', introducedOn: '2026-10-10', stage: 6 }
  const dates = consolidationStudyDates(p)
  assert.deepEqual(dates, ['2026-10-25', '2026-10-28', '2026-10-31'])
  const dueDates = new Set(pool(90).map(q => studyDay(effectiveReviewDue(record, p, srsKey(q)))))
  assert.deepEqual(dueDates, new Set(dates))
  const question = pool(1)[0]
  const timestamp = effectiveReviewDue(record, p, srsKey(question))
  const session = buildStudyPlan([question], { [srsKey(question)]: record }, {}, { now: timestamp, studyPlan: p })
  assert.equal(session.reviewCount, 1)
  const reviewed = review(record, true, timestamp, { studyPlan: p, questionKey: srsKey(question) })
  assert.equal(reviewed.reviews, 2)
  assert.ok(Date.parse(reviewed.dueAt) > timestamp)
  assert.ok(validSrsRecord(reviewed))
})

test('first sign-in fixes the start date, subsequent sign-ins preserve it, and exam changes replan', () => {
  ensureStudyRoadmap('2026-10-20T03:00:00Z', NOW)
  assert.equal(getStudyRoadmap().startDate, '2026-10-20')
  ensureStudyRoadmap('2026-10-27T03:00:00Z', NOW + DAY)
  assert.equal(getStudyRoadmap().startDate, '2026-10-20')
  saveStudyExamDate('2026-12-01', NOW)
  assert.equal(getStudyRoadmap().examDate, '2026-12-01')
  assert.equal(getStudyRoadmap().customExam, true)
  resetAllProgress()
  assert.equal(getStudyRoadmap().startDate, '2026-10-20')
  assert.equal(getStudyRoadmap().examDate, '2026-12-01')
})

test('fresh defaults after the old exam remain in the future, and impossible dates are rejected', () => {
  assert.equal(defaultExamDate('2026-11-22'), '2026-12-22')
  assert.equal(validDay('2026-02-30'), false)
  assert.equal(validDay('2028-02-29'), true)
  assert.equal(validStudyRoadmap({ ...plan(), examDate: '2026-02-30' }), false)
  assert.throws(() => saveStudyExamDate('2026-10-26', NOW))
})

test('schedules and roadmap persist in account snapshots and restore without losing validation', () => {
  ensureStudyRoadmap(null, NOW)
  const question = pool(1)[0]
  const saved = recordSpacedAnswer(question, true, { now: NOW, reviewId: 'saved' })
  const snapshot = readProgressSnapshot()
  assert.deepEqual(snapshot.n3vjit_spacedRepetition[srsKey(question)], saved)
  assert.ok(snapshot.n3vjit_studyRoadmap)
  assert.doesNotThrow(() => parseProgressBackup(JSON.stringify({ version: 1, data: snapshot })))
  setStorageUser('second-user')
  assert.deepEqual(getSpacedRepetition(), {})
  assert.equal(getStudyRoadmap(), null)
  writeProgressSnapshot(snapshot)
  assert.equal(getSpacedRepetition()[srsKey(question)].lastReviewId, 'saved')
})

test('malformed SRS fields and invalid roadmap data cannot replace existing progress', () => {
  const saved = review()
  for (const invalid of [{ stage: -1 }, { stage: 7 }, { dueAt: 'bad' }, { reviews: 0 }, { introducedOn: 'fake' }, { lastReviewId: '' }, { lapses: 2 }]) {
    assert.throws(() => parseProgressBackup(JSON.stringify({ n3vjit_spacedRepetition: { key: { ...saved, ...invalid } } })))
  }
  assert.throws(() => writeProgressSnapshot({ n3vjit_studyRoadmap: { ...plan(), startDate: '2030-01-01' } }))
})

test('simultaneous device records merge atomically and converge even on equal timestamps', () => {
  const base = review()
  const correct = review(base, true, NOW + DAY)
  const wrong = review(base, false, NOW + DAY, { reviewId: 'other-device' })
  assert.equal(newerSrsRecord(correct, wrong), wrong)
  assert.equal(newerSrsRecord(wrong, correct), wrong)
  const result = reconcileProgress({ n3vjit_spacedRepetition: { key: base } }, { n3vjit_spacedRepetition: { key: correct } }, { n3vjit_spacedRepetition: { key: wrong } })
  assert.deepEqual(result.n3vjit_spacedRepetition.key, wrong)
  assert.equal(result.n3vjit_spacedRepetition.key.stage, 0)
})

test('a provisional new device plan cannot overwrite the chosen exam date or first login', () => {
  const chosen = { ...plan('2026-12-01'), startDate: '2026-10-01' }
  const provisional = { ...plan(), customExam: false, updatedAt: new Date(NOW + DAY).toISOString() }
  const merged = mergeStudyRoadmaps(chosen, provisional)
  assert.equal(merged.examDate, '2026-12-01')
  assert.equal(merged.startDate, '2026-10-01')
  assert.deepEqual(mergeStudyRoadmaps(provisional, chosen), merged)
  const initial = reconcileProgress(null, { n3vjit_studyRoadmap: provisional }, { n3vjit_studyRoadmap: chosen })
  assert.equal(initial.n3vjit_studyRoadmap.examDate, chosen.examDate)
})

test('guest study never creates a schedule, start date or exam preference', () => {
  setStorageUser(null)
  ensureStudyRoadmap(null, NOW)
  assert.equal(recordSpacedAnswer(pool(1)[0], true, { now: NOW, reviewId: 'guest' }), null)
  assert.equal(getStudyRoadmap(), null)
  assert.deepEqual(getSpacedRepetition(), {})
  assert.throws(() => saveStudyExamDate('2026-12-01', NOW), /Đăng nhập/)
  assert.equal(data.size, 0)
})

test('the daily forecast covers the full bank before consolidation and accounts for today already studied', () => {
  const days = forecastStudyDays(plan(), { today: '2026-10-26', unseenCount: 184, newToday: 6, reviewDays: { '2026-10-27': 12 } }, 30)
  assert.equal(days[0].newCount, 4)
  assert.equal(days[1].reviewCount, 12)
  assert.equal(days.reduce((sum, day) => sum + day.newCount, 0), 184)
  assert.ok(days.filter(day => day.phase !== 'learning').every(day => day.newCount === 0))
  assert.equal(days.at(-1).date, '2026-11-21')
})

test('seven-day previews include known overdue and consolidation reviews, but not invented future results', () => {
  const question = pool(1)[0]
  const record = review(null, false, NOW - 3600000)
  const session = buildStudyPlan([question], { [srsKey(question)]: record }, {}, { now: NOW, studyPlan: plan() })
  assert.equal(session.forecast.length, 7)
  assert.equal(session.forecast[0].reviewCount, 1)
  assert.ok(session.forecast.slice(1).every(day => day.reviewCount === 0))
})

test('the default roadmap reserves two full mock exams and two correction days with zero new questions', () => {
  const events = plannedExamSessions(plan())
  assert.deepEqual(events.map(event => [event.date, event.kind]), [['2026-11-15', 'mock'], ['2026-11-16', 'correction'], ['2026-11-18', 'mock'], ['2026-11-19', 'correction']])
  const forecast = forecastStudyDays(plan(), { today: '2026-10-26', unseenCount: 257 }, 30)
  for (const event of events) assert.equal(forecast.find(day => day.date === event.date).newCount, 0)
  assert.equal(forecast.reduce((sum, day) => sum + day.newCount, 0), 257)
})

test('mock days offer a short optional review and do not assign fresh questions even with a large backlog', () => {
  const questions = pool(100)
  const records = Object.fromEntries(questions.slice(0, 50).map(q => [srsKey(q), review(null, true, NOW - 2 * DAY)]))
  const session = buildStudyPlan(questions, records, {}, { now: Date.parse('2026-11-15T03:00:00Z'), studyPlan: plan() })
  assert.equal(session.roadmap.todayEvent.kind, 'mock')
  assert.equal(session.newCount, 0)
  assert.equal(session.reviewCount, 10)
  assert.equal(session.roadmap.sessionsToday, 1)
})

test('short windows reserve one mock and combine correction when only one day remains', () => {
  assert.equal(plannedExamSessions(plan('2026-11-03')).filter(event => event.kind === 'mock').length, 1)
  const events = plannedExamSessions(plan('2026-10-27'))
  assert.equal(events.length, 1)
  assert.equal(events[0].combined, true)
  const today = calculateRoadmap(plan('2026-10-27'), { today: '2026-10-26', unseenCount: 257, newToday: 0 })
  assert.equal(today.dailyNewTarget, 0)
  assert.equal(today.insufficientStudyTime, true)
})
