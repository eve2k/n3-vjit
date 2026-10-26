export const DEFAULT_EXAM_DATE = '2026-11-21'
export const ROADMAP_TIMEZONE = 'Asia/Ho_Chi_Minh'
const DAY = 86400000
export const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
export const shiftDay = (day, amount) => new Date(Date.parse(`${day}T00:00:00Z`) + amount * DAY).toISOString().slice(0, 10)
export const daysBetween = (start, end) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY)
export const dayStart = day => Date.parse(`${day}T00:00:00+07:00`)
export const formatStudyDay = day => day.split('-').reverse().join('/')
export const defaultExamDate = today => today < DEFAULT_EXAM_DATE ? DEFAULT_EXAM_DATE : shiftDay(today, 30)

export function validStudyRoadmap(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && validDay(value.startDate) && validDay(value.examDate) && value.examDate >= value.startDate &&
    typeof value.customExam === 'boolean' && typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt))
}

export function roadmapDates(plan) {
  const totalDays = Math.max(0, daysBetween(plan.startDate, plan.examDate))
  const consolidationDays = Math.min(7, Math.floor(totalDays / 3))
  return { totalDays, consolidationDays, consolidationStart: shiftDay(plan.examDate, -consolidationDays) }
}

export function plannedExamSessions(plan) {
  const span = daysBetween(plan.startDate, plan.examDate)
  const offsets = span >= 14 ? [6, 3] : span >= 5 ? [3] : span >= 1 ? [1] : []
  return offsets.flatMap((offset, index) => {
    const number = index + 1
    const mock = { date: shiftDay(plan.examDate, -offset), kind: 'mock', number, combined: offset === 1 }
    return offset === 1 ? [mock] : [mock, { date: shiftDay(plan.examDate, -offset + 1), kind: 'correction', number, combined: false }]
  }).filter(event => event.date >= plan.startDate)
}

function availableStudyDays(start, end, events) {
  const reserved = new Set(events.filter(event => event.date >= start && event.date < end).map(event => event.date))
  return Math.max(0, daysBetween(start, end) - reserved.size)
}

export function calculateRoadmap(plan, { today, unseenCount, newToday, dueCount = 0, sessionLimit = 20 }) {
  if (!validStudyRoadmap(plan) || !validDay(today)) throw new Error('Lộ trình học không hợp lệ.')
  const dates = roadmapDates(plan)
  const events = plannedExamSessions(plan)
  const todayEvent = events.find(event => event.date === today) || null
  const daysLeft = Math.max(0, daysBetween(today, plan.examDate))
  const learningDaysLeft = availableStudyDays(today, dates.consolidationStart, events)
  const catchingUp = learningDaysLeft === 0 && daysLeft > 0 && unseenCount > 0
  const availableDays = learningDaysLeft || availableStudyDays(today, plan.examDate, events)
  // Use the remaining material at the start of TODAY so answering a question
  // doesn't keep increasing today's target (unseen decreases as newToday rises).
  const dailyNewTarget = !todayEvent && availableDays > 0 ? Math.ceil((unseenCount + newToday) / availableDays) : 0
  const reviewTargetToday = todayEvent ? Math.min(10, dueCount) : dueCount
  return {
    ...dates, daysLeft, learningDaysLeft, catchingUp, dailyNewTarget, events, todayEvent, reviewTargetToday,
    insufficientStudyTime: unseenCount > 0 && availableDays === 0 && daysLeft > 0,
    newRemainingToday: Math.max(0, dailyNewTarget - newToday),
    sessionsToday: Math.ceil((reviewTargetToday + Math.max(0, dailyNewTarget - newToday)) / sessionLimit),
    phase: today >= plan.examDate ? 'exam' : today >= dates.consolidationStart ? 'consolidation' : 'learning',
    examPassed: today > plan.examDate,
  }
}

export function forecastStudyDays(plan, { today, unseenCount, newToday = 0, reviewDays = {} }, length = 7) {
  const days = []
  let remaining = unseenCount
  for (let index = 0; index < length; index++) {
    const date = shiftDay(today, index)
    if (date > plan.examDate) break
    const roadmap = calculateRoadmap(plan, { today: date, unseenCount: remaining, newToday: index === 0 ? newToday : 0 })
    const newCount = Math.min(remaining, roadmap.newRemainingToday)
    days.push({ date, newCount, reviewCount: reviewDays[date] || 0, phase: roadmap.phase, event: roadmap.todayEvent })
    remaining -= newCount
  }
  return days
}

// A complete plan converges across devices. An automatic default cannot replace
// a user-chosen exam date, and the first start date is preserved.
export function mergeStudyRoadmaps(left, right) {
  if (!left) return right
  if (!right) return left
  const winner = left.customExam !== right.customExam ? (left.customExam ? left : right) :
    Date.parse(left.updatedAt) !== Date.parse(right.updatedAt) ? (Date.parse(left.updatedAt) > Date.parse(right.updatedAt) ? left : right) :
      left.examDate > right.examDate ? left : right
  return { ...winner, startDate: left.startDate < right.startDate ? left.startDate : right.startDate }
}

export function consolidationStudyDates(plan) {
  const { consolidationDays, consolidationStart } = roadmapDates(plan)
  const reserved = new Set(plannedExamSessions(plan).map(event => event.date))
  return Array.from({ length: consolidationDays }, (_, index) => shiftDay(consolidationStart, index)).filter(date => !reserved.has(date))
}

export function effectiveReviewDue(record, plan, questionKey = '') {
  let due = Date.parse(record.dueAt)
  if (!plan || !validStudyRoadmap(plan)) return due
  const reviewed = Date.parse(record.lastReviewedAt)
  const dates = consolidationStudyDates(plan)
  if (dates.length) {
    // Stable question groups spread the consolidation sweep across available
    // review days. Mock exams and correction days keep their reserved time.
    const hash = [...questionKey].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0)
    const checkpoint = dayStart(dates[hash % dates.length]) + DAY / 2
    if (reviewed < checkpoint) due = Math.min(due, checkpoint)
  }
  return due
}
