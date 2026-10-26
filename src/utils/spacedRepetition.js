import { calculateRoadmap, effectiveReviewDue, forecastStudyDays } from './studyRoadmap.js'

export const SRS_INTERVALS = [1, 3, 7, 14, 30, 60]
export const SRS_NEW_LIMIT = 10
export const SRS_SESSION_LIMIT = 20
export const SRS_TIMEZONE = 'Asia/Ho_Chi_Minh'
const DAY = 86400000
const RETRY = 10 * 60000
const dateValid = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const count = value => Number.isSafeInteger(value) && value >= 0

export const srsKey = question => `${question.section}:${question.id}`
export function studyDay(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: SRS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const value = name => parts.find(part => part.type === name).value
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function validSrsRecord(item) {
  return item !== null && typeof item === 'object' && !Array.isArray(item) &&
    count(item.stage) && item.stage <= SRS_INTERVALS.length && count(item.reviews) && item.reviews > 0 &&
    count(item.lapses) && item.lapses <= item.reviews && count(item.correctStreak) && item.correctStreak <= item.reviews &&
    dateValid(item.dueAt) && dateValid(item.lastReviewedAt) && dateValid(item.firstReviewedAt) &&
    Date.parse(item.dueAt) >= Date.parse(item.lastReviewedAt) && Date.parse(item.firstReviewedAt) <= Date.parse(item.lastReviewedAt) &&
    typeof item.lastCorrect === 'boolean' && typeof item.lastReviewId === 'string' && item.lastReviewId.length > 0 && item.lastReviewId.length <= 200 &&
    (item.introducedOn === null || (typeof item.introducedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.introducedOn) && item.introducedOn === studyDay(Date.parse(item.firstReviewedAt))))
}

export function scheduleReview(previous, correct, { now = Date.now(), reviewId, isNew = true, studyPlan = null, questionKey = '' } = {}) {
  if (!Number.isFinite(now) || typeof correct !== 'boolean' || typeof reviewId !== 'string' || !reviewId || reviewId.length > 200) throw new Error('Lượt ôn không hợp lệ.')
  if (previous && !validSrsRecord(previous)) throw new Error('Lịch ôn không hợp lệ.')
  if (previous && (previous.lastReviewId === reviewId || now < Date.parse(previous.lastReviewedAt) || (correct && now < effectiveReviewDue(previous, studyPlan, questionKey)))) return previous
  const stage = correct ? Math.min((previous?.stage || 0) + 1, SRS_INTERVALS.length) : 0
  const timestamp = new Date(now).toISOString()
  const record = {
    stage, dueAt: new Date(now + (correct ? SRS_INTERVALS[stage - 1] * DAY : RETRY)).toISOString(),
    firstReviewedAt: previous?.firstReviewedAt || timestamp, lastReviewedAt: timestamp,
    introducedOn: previous ? previous.introducedOn : isNew ? studyDay(now) : null,
    reviews: (previous?.reviews || 0) + 1, lapses: (previous?.lapses || 0) + (correct ? 0 : 1),
    correctStreak: correct ? (previous?.correctStreak || 0) + 1 : 0,
    lastCorrect: correct, lastReviewId: reviewId,
  }
  if (correct && studyPlan) record.dueAt = new Date(effectiveReviewDue(record, studyPlan, questionKey)).toISOString()
  return record
}

// Keep a complete schedule record from one attempt; never mix its stage and due date.
export function newerSrsRecord(left, right) {
  if (!left) return right
  if (!right) return left
  const difference = Date.parse(right.lastReviewedAt) - Date.parse(left.lastReviewedAt)
  if (difference) return difference > 0 ? right : left
  // Concurrent attempts at the same timestamp converge; a lapse takes priority.
  if (left.lastCorrect !== right.lastCorrect) return left.lastCorrect ? right : left
  return right.lastReviewId > left.lastReviewId ? right : left
}

function interleave(questions) {
  const groups = new Map()
  for (const question of questions) {
    if (!groups.has(question.section)) groups.set(question.section, [])
    groups.get(question.section).push(question)
  }
  const result = []
  for (let index = 0; result.length < questions.length; index++) for (const group of groups.values()) if (group[index]) result.push(group[index])
  return result
}

export function buildStudyPlan(questions, records = {}, completed = {}, { now = Date.now(), sectionId = 'all', newLimit = SRS_NEW_LIMIT, sessionLimit = SRS_SESSION_LIMIT, studyPlan = null } = {}) {
  if (!Number.isFinite(now) || !Number.isInteger(newLimit) || newLimit < 0 || !Number.isInteger(sessionLimit) || sessionLimit < 1) throw new Error('Cấu hình phiên học không hợp lệ.')
  const known = questions.filter(question => Object.hasOwn(question.options || {}, question.correctAnswer))
  const pool = known.filter(question => sectionId === 'all' || question.section === sectionId)
  const today = studyDay(now)
  const newToday = known.filter(question => records[srsKey(question)]?.introducedOn === today).length
  const completedIds = new Map(Object.entries(completed).map(([section, ids]) => [section, new Set(ids)]))
  const reviewedBefore = question => completedIds.get(question.section)?.has(question.id)
  const dueValues = new Map(known.map(question => {
    const key = srsKey(question)
    return [key, records[key] ? effectiveReviewDue(records[key], studyPlan, key) : 0]
  }))
  const dueTime = question => dueValues.get(srsKey(question)) || 0
  const due = pool.filter(question => records[srsKey(question)] ? dueTime(question) <= now : reviewedBefore(question))
    .sort((a, b) => dueTime(a) - dueTime(b))
  const fresh = pool.filter(question => !records[srsKey(question)] && !reviewedBefore(question))
  const allFresh = known.filter(question => !records[srsKey(question)] && !reviewedBefore(question)).length
  const allDue = known.filter(question => records[srsKey(question)] ? dueTime(question) <= now : reviewedBefore(question)).length
  const roadmap = studyPlan ? calculateRoadmap(studyPlan, { today, unseenCount: allFresh, newToday, dueCount: allDue, sessionLimit }) : null
  const dailyLimit = roadmap ? roadmap.dailyNewTarget : newLimit
  const reviewDays = Object.create(null)
  if (roadmap) for (const question of known) {
    if (!records[srsKey(question)] && !reviewedBefore(question)) continue
    const due = dueTime(question)
    const date = due <= now ? today : studyDay(due)
    reviewDays[date] = (reviewDays[date] || 0) + 1
  }
  const effectiveLimit = roadmap?.todayEvent ? Math.min(10, sessionLimit) : sessionLimit
  const reviewQuestions = due.slice(0, effectiveLimit)
  const newQuestions = interleave(fresh).slice(0, Math.min(Math.max(0, dailyLimit - newToday), effectiveLimit - reviewQuestions.length))
  const future = pool.filter(question => records[srsKey(question)]).map(dueTime).filter(time => time > now)
  return {
    questions: [...reviewQuestions, ...newQuestions], reviewCount: reviewQuestions.length, newCount: newQuestions.length,
    dueCount: due.length, unseenCount: fresh.length, newToday, newAllowance: Math.max(0, dailyLimit - newToday), dailyLimit, roadmap,
    forecast: roadmap ? forecastStudyDays(studyPlan, { today, unseenCount: allFresh, newToday, reviewDays }) : [],
    nextDueAt: future.length ? new Date(Math.min(...future)).toISOString() : null,
  }
}

export function formatReviewDate(value) {
  return new Date(value).toLocaleString('vi-VN', { timeZone: SRS_TIMEZONE, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}
