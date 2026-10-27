import { applyReviewAnswer, newerMasteryRecord } from './masteryLearning.js'
import { eligibleReviewCards, selectReviewCards, createReviewItems, gradeReviewAnswer, reviewCatalog, REVIEW_MODES, supportsWritten } from './reviewLearning.js'
import { canonicalReviewKey, latestAnswerEntry } from './reviewQuestionIds.js'

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 200
const sources = ['practice', 'checkpoint', 'review-test', 'review-retry']
const stamp = (now, updateId) => {
  if (!Number.isFinite(now) || !id(updateId)) throw new Error('Thời điểm hoặc ID cập nhật không hợp lệ.')
  return { updatedAt: new Date(now).toISOString(), updateId }
}
export const emptyReviewProgress = () => ({ results: {}, session: null })

export function newerReviewResult(left, right) {
  if (!left) return right
  if (!right) return left
  const delta = Date.parse(left.answeredAt) - Date.parse(right.answeredAt)
  return delta ? (delta > 0 ? left : right) : (left.updateId >= right.updateId ? left : right)
}

// A single bounded closure marker survives cleanup. It prevents an offline
// device's later edits to the same session from resurrecting its questions.
export function newerReviewSession(left, right) {
  if (!left) return right ?? null
  if (!right) return left
  if (left.id === right.id) {
    if (left.data === null && right.data !== null) return left
    if (right.data === null && left.data !== null) return right
    return newerMasteryRecord(left, right)
  }
  const delta = Date.parse(left.startedAt) - Date.parse(right.startedAt)
  return delta ? (delta > 0 ? left : right) : (left.id >= right.id ? left : right)
}

export function mergeReviewProgress(left = emptyReviewProgress(), right = emptyReviewProgress()) {
  const results = Object.fromEntries([...new Set([...Object.keys(left.results), ...Object.keys(right.results)])]
    .map(key => [key, newerReviewResult(left.results[key], right.results[key])]))
  return { results, session: newerReviewSession(left.session, right.session) }
}

export function recordReviewResult(progress, key, correct, { now, updateId, source = 'practice', selfCorrected = false } = {}) {
  if (typeof correct !== 'boolean' || !sources.includes(source)) throw new Error('Kết quả không hợp lệ.')
  const { updatedAt } = stamp(now, updateId)
  const existing = latestAnswerEntry(progress.results, key)
  const reviewed = source === 'review-test' || source === 'review-retry'
  const result = { correct, answeredAt: updatedAt, updateId, source,
    ...(reviewed ? { lastReviewedAt: updatedAt } : existing?.value.lastReviewedAt ? { lastReviewedAt: existing.value.lastReviewedAt } : {}),
    ...(selfCorrected ? { selfCorrected: true } : {}) }
  if (existing && newerReviewResult(existing.value, result) === existing.value) return progress
  // Reuse the stored alias when there is one; don't rename historical IDs.
  const storedKey = existing?.key || canonicalReviewKey(key)
  return { ...progress, results: { ...progress.results, [storedKey]: result } }
}

export function beginReview(progress, mastery, settings, { now, updateId, random = Math.random } = {}) {
  if (progress.session?.data) throw new Error('Hãy hoàn tất hoặc hủy bài kiểm tra đang làm.')
  const { stageId, mode = 'multiple-choice', lessonIds = null, retryKeys = null, count, prioritizeOld = false } = settings
  const pool = eligibleReviewCards(stageId, mastery, progress.results, { lessonIds, retryKeys })
  const questions = selectReviewCards(pool, { count, prioritizeOld, mastery, results: progress.results, random })
  const items = createReviewItems(questions, mode, stageId, random)
  const meta = stamp(now, updateId)
  const session = { id: updateId, startedAt: meta.updatedAt, ...meta,
    data: { stageId, mode, kind: retryKeys === null ? 'mastered' : 'retry', items, answers: {}, cursor: 0 } }
  if (progress.session && newerReviewSession(progress.session, session) !== session) throw new Error('Thời điểm phiên mới phải sau phiên trước.')
  return { ...progress, session }
}

function activeSession(progress, sessionId) {
  if (!progress.session?.data || progress.session.id !== sessionId) throw new Error('Phiên kiểm tra đã đóng hoặc đã thay đổi trên thiết bị khác.')
  return progress.session
}

export function reviewCursor(session) {
  if (!session?.data) return 0
  if (session.data.cursor !== undefined) return session.data.cursor
  const index = session.data.items.findIndex(item => !session.data.answers[item.key])
  return index < 0 ? session.data.items.length - 1 : index
}

export function advanceReview(progress, sessionId, { now, updateId } = {}) {
  const session = activeSession(progress, sessionId)
  const cursor = reviewCursor(session)
  if (!session.data.answers[session.data.items[cursor].key]) throw new Error('Hãy trả lời câu hiện tại trước.')
  if (cursor >= session.data.items.length - 1) return progress
  const meta = stamp(now, updateId)
  if (newerMasteryRecord(session, meta) === session) return progress
  return { ...progress, session: { ...session, ...meta, data: { ...session.data, cursor: cursor + 1 } } }
}

export function answerReview(progress, sessionId, key, response, { now, updateId, selfCorrected = false } = {}) {
  const session = activeSession(progress, sessionId)
  const canonical = canonicalReviewKey(key)
  const item = session.data.items.find(item => item.key === canonical)
  const question = reviewCatalog(session.data.stageId).find(q => q.key === canonical)
  if (!item || !question) throw new Error('Câu hỏi không thuộc bài kiểm tra.')
  const existing = session.data.answers[canonical]
  if (existing) {
    // Answers are locked; only a submitted written answer may be self-corrected.
    if (item.mode !== 'written' || !selfCorrected || existing.selfCorrected || existing.response !== response) return progress
  } else if (selfCorrected) throw new Error('Hãy nộp câu tự luận trước khi tự xác nhận.')
  gradeReviewAnswer(item, question, response, selfCorrected)
  const meta = stamp(now, updateId)
  if (newerMasteryRecord(session, meta) === session) return progress
  return { ...progress, session: { ...session, ...meta, data: { ...session.data,
    answers: { ...session.data.answers, [canonical]: { response, selfCorrected } } } } }
}

export function closeReview(progress, sessionId, now, updateId) {
  const session = activeSession(progress, sessionId)
  const meta = stamp(now, updateId)
  if (Date.parse(meta.updatedAt) < Date.parse(session.updatedAt)) throw new Error('Thời điểm đóng phiên không hợp lệ.')
  return { ...progress, session: { id: session.id, startedAt: session.startedAt, ...meta, data: null } }
}

export function finishReview(progress, mastery, sessionId, { now, updateId } = {}) {
  // Repeated submit after cleanup is a no-op, including after reload/sync.
  if (progress.session?.id === sessionId && progress.session.data === null) return { progress, mastery, summary: null }
  const session = activeSession(progress, sessionId)
  const questions = new Map(reviewCatalog(session.data.stageId).map(q => [q.key, q]))
  let next = progress
  const cards = { ...mastery.cards }
  const outcomes = session.data.items.map(item => {
    const answer = session.data.answers[item.key]
    if (!answer) throw new Error('Hãy trả lời đủ các câu trước khi hoàn thành.')
    const correct = gradeReviewAnswer(item, questions.get(item.key), answer.response, answer.selfCorrected)
    next = recordReviewResult(next, item.key, correct, { now, updateId,
      source: session.data.kind === 'retry' ? 'review-retry' : 'review-test', selfCorrected: answer.selfCorrected })
    if (supportsWritten(session.data.stageId) && cards[item.key]) cards[item.key] = applyReviewAnswer(cards[item.key], correct, now, updateId)
    return { key: item.key, correct }
  })
  return { progress: closeReview(next, sessionId, now, updateId), mastery: { ...mastery, cards },
    summary: { total: outcomes.length, correct: outcomes.filter(item => item.correct).length,
      wrongKeys: outcomes.filter(item => !item.correct).map(item => item.key) } }
}

export function validReviewProgress(value) {
  if (!object(value) || !object(value.results) || !(value.session === null || object(value.session))) return false
  const validResult = item => object(item) && typeof item.correct === 'boolean' && date(item.answeredAt) && id(item.updateId) && sources.includes(item.source) &&
    (item.lastReviewedAt === undefined || (date(item.lastReviewedAt) && Date.parse(item.lastReviewedAt) <= Date.parse(item.answeredAt))) &&
    (item.selfCorrected === undefined || (item.selfCorrected === true && item.correct && ['review-test', 'review-retry'].includes(item.source)))
  if (!Object.entries(value.results).every(([key, item]) => /^[\w-]+:[\w-]+$/.test(key) && validResult(item))) return false
  const session = value.session
  if (!session) return true
  if (!id(session.id) || !id(session.updateId) || !date(session.startedAt) || !date(session.updatedAt) || Date.parse(session.updatedAt) < Date.parse(session.startedAt)) return false
  const data = session.data
  if (data === null) return Object.keys(session).every(key => ['id', 'startedAt', 'updatedAt', 'updateId', 'data'].includes(key))
  if (!object(data) || !REVIEW_MODES.includes(data.mode) || !['mastered', 'retry'].includes(data.kind) || (data.mode === 'written' && !supportsWritten(data.stageId)) ||
    !Array.isArray(data.items) || !data.items.length || data.items.length > 512 || !object(data.answers)) return false
  if (data.cursor !== undefined && (!Number.isInteger(data.cursor) || data.cursor < 0 || data.cursor >= data.items.length)) return false
  const questions = new Map(reviewCatalog(data.stageId).map(q => [q.key, q]))
  const keys = new Set()
  for (const item of data.items) {
    if (!object(item) || item.mode !== data.mode || keys.has(item.key) || !questions.has(item.key)) return false
    keys.add(item.key)
    const question = questions.get(item.key)
    if (item.mode === 'true-false' && !Object.hasOwn(question.options, item.candidate)) return false
    if (item.mode === 'multiple-choice' && (!Array.isArray(item.choices) || new Set(item.choices).size !== item.choices.length ||
      item.choices.length !== Object.keys(question.options).length || item.choices.some(key => !Object.hasOwn(question.options, key)))) return false
  }
  return Object.entries(data.answers).every(([key, answer]) => {
    if (!keys.has(key) || !object(answer) || typeof answer.selfCorrected !== 'boolean') return false
    try { gradeReviewAnswer(data.items.find(item => item.key === key), questions.get(key), answer.response, answer.selfCorrected); return true } catch { return false }
  })
}
