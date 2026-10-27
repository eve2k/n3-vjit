export const cardKey = question => `${question.section}:${question.id}`
export const LEVEL_LABELS = ['Chưa biết', 'Tạm', 'Biết sơ', 'Thành thạo']
const isObject = value => value && typeof value === 'object' && !Array.isArray(value)
const count = value => Number.isSafeInteger(value) && value >= 0
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const stamp = (now, updateId) => ({ updatedAt: new Date(now).toISOString(), updateId })
export const nextCardTime = (card, now) => {
  const previous = Date.parse(card?.updatedAt)
  return Math.max(now, Number.isFinite(previous) ? previous + 1 : now)
}

export const needsRecheck = card => card?.level === 2 && card.needsRecheck === true
export const needsConsolidation = card => Boolean(card && (card.level < 2 || needsRecheck(card)))

// Review tests do not teach a new level. A flagged card is the one exception:
// a successful recovery restores mastery; a second failure returns it to level 1.
export function applyReviewAnswer(card, correct, now, updateId) {
  if (!card || typeof correct !== 'boolean') throw new Error('Thẻ kiểm tra không hợp lệ.')
  const nextStamp = stamp(nextCardTime(card, now), updateId)
  if (!updateId) throw new Error('Thiếu ID lượt kiểm tra.')
  if (card.updateId === updateId) return card
  const { needsRecheck: _flag, ...previous } = card
  const level = correct ? (needsRecheck(card) ? 3 : card.level) : Math.max(0, card.level - 1)
  return { ...previous, level, lastResult: correct ? 'correct' : 'wrong', lastReviewedAt: nextStamp.updatedAt,
    ...(!correct && card.level === 3 ? { needsRecheck: true } : {}), ...nextStamp }
}

export function nodeStatus(keys, cards = {}, completedRounds = 0) {
  const counts = [0, 0, 0, 0]
  for (const key of keys) counts[cards[key]?.level ?? 0]++
  const total = keys.length
  return { counts, total, passed: total > 0 && ((counts[2] + counts[3]) / total >= .8 || completedRounds >= 3), mastered: total > 0 && counts[3] === total }
}

export function createRound(keys, oldKeys, cards, round = 1, completedRounds = 0, now = Date.now(), updateId = '') {
  const queue = keys.filter(key => (cards[key]?.level ?? 0) < 3)
  const old = keys.length < 5 ? [] : oldKeys.filter(key => cards[key] && cards[key].level < 3 && !keys.includes(key))
    .sort((a, b) => cards[a].level - cards[b].level || a.localeCompare(b)).slice(0, Math.ceil(keys.length * .25))
  if (old.length) {
    const first = Math.ceil(old.length / 2)
    queue.unshift(...old.slice(0, first))
    queue.splice(Math.ceil(queue.length / 2), 0, ...old.slice(first))
  }
  return { round, completedRounds, queue, requeues: {}, advanced: [], feedback: null, answered: 0, total: queue.length, roundStartLevels: Object.fromEntries(keys.map(key => [key, cards[key]?.level ?? 0])), wrongKeys: [], summary: null, ...stamp(now, updateId) }
}

export function nodeLearningDecision(keys, cards = {}, session = null) {
  const weakCount = keys.filter(key => (cards[key]?.level ?? 0) < 3).length
  if (!session) return { action: 'start', round: 1, weakCount }
  if (session.feedback || session.queue.length) return { action: 'resume', round: session.round, weakCount }
  if (weakCount) return { action: 'review', round: session.round + 1, weakCount }
  return { action: 'summary', round: session.round, weakCount: 0 }
}

export function enterNodeRound(keys, oldKeys, cards, session, now, updateId) {
  const decision = nodeLearningDecision(keys, cards, session)
  const flaggedOnly = decision.action === 'review' && keys.every(key => cards[key]?.level === 3 || needsRecheck(cards[key]))
  const sessionTime = Date.parse(session?.updatedAt)
  const roundTime = Math.max(now, Number.isFinite(sessionTime) ? sessionTime + 1 : now)
  return { ...decision, session: decision.action === 'start' || decision.action === 'review'
    ? createRound(keys, flaggedOnly ? [] : oldKeys, cards, decision.round, session?.completedRounds || 0, roundTime, updateId)
    : session }
}

export function currentRoundSituation(keys, cards, completedRounds, isLastNode, snapshot = null) {
  const levels = Object.fromEntries(keys.map(key => [key, cards[key]?.level ?? 0]))
  return { ...roundSummarySituation(levels, completedRounds, isLastNode),
    changedSinceRound: Boolean(snapshot && keys.some(key => levels[key] !== snapshot.endLevels[key])) }
}

export function answerCard(session, cards, correct, now, updateId) {
  if (!session.queue.length || session.feedback) return { session, cards }
  const key = session.queue[0]
  const old = cards[key]?.level ?? 0
  const flagged = needsRecheck(cards[key])
  const level = correct ? (flagged ? 3 : Math.min(3, old + (session.advanced.includes(key) ? 0 : 1))) : Math.max(0, old - 1)
  const { needsRecheck: _flag, ...previous } = cards[key] || {}
  const cardStamp = stamp(nextCardTime(cards[key], now), updateId)
  const nextCards = { ...cards, [key]: { ...previous, level, lastResult: correct ? 'correct' : 'wrong',
    ...(flagged ? { lastReviewedAt: cardStamp.updatedAt } : {}), ...cardStamp } }
  const queue = session.queue.slice(1)
  const requeues = { ...session.requeues }
  if (!correct && (requeues[key] || 0) < 2) {
    requeues[key] = (requeues[key] || 0) + 1
    // Insert after 2 or 3 remaining questions; existing retries retain FIFO order.
    let position = Math.min(queue.length, 2 + ((requeues[key] - 1) % 2))
    while (position < queue.length && Object.hasOwn(requeues, queue[position])) position++
    queue.splice(position, 0, key)
  }
  const advanced = correct && !session.advanced.includes(key) ? [...session.advanced, key] : session.advanced
  return { cards: nextCards, session: { ...session, queue, requeues, advanced, answered: session.answered + 1, total: session.answered + 1 + queue.length, feedback: { key, correct, previousLevel: old, level }, wrongKeys: correct ? (session.wrongKeys || []) : [...new Set([...(session.wrongKeys || []), key])], ...stamp(now, updateId) } }
}

export function advanceAfterFeedback(session, now, updateId, cards = {}) {
  if (!session.feedback) return session
  const finished = session.queue.length === 0
  const summary = finished && session.roundStartLevels ? {
    round: session.round, startLevels: session.roundStartLevels,
    endLevels: Object.fromEntries(Object.keys(session.roundStartLevels).map(key => [key, cards[key]?.level ?? 0])),
    wrongKeys: session.wrongKeys || [],
  } : session.summary || null
  return { ...session, feedback: null, completedRounds: finished ? session.completedRounds + 1 : session.completedRounds, summary, ...stamp(now, updateId) }
}

export function roundSummarySituation(levels, completedRounds, isLastNode) {
  const values = Object.values(levels)
  const total = values.length
  const counts = [0, 0, 0, 0]
  values.forEach(level => { counts[level]++ })
  const mastered = total > 0 && counts[3] === total
  const threshold = total > 0 && (counts[2] + counts[3]) / total >= .8
  const maxRounds = completedRounds >= 3
  return { counts, total, mastered, threshold, maxRounds, canAdvance: threshold || maxRounds, isLastNode, minimumRounds: total ? Math.max(...values.map(level => 3 - level)) : 0 }
}

export function roundChanges(summary) {
  if (!summary) return null
  let up = 0, down = 0
  for (const key of Object.keys(summary.startLevels)) {
    const difference = (summary.endLevels[key] ?? 0) - summary.startLevels[key]
    if (difference > 0) up++
    if (difference < 0) down++
  }
  return { up, down }
}

export function validMasteryProgress(value) {
  if (!isObject(value) || !isObject(value.cards) || !isObject(value.nodes)) return false
  const validStamp = item => date(item.updatedAt) && typeof item.updateId === 'string' && item.updateId.length > 0 && item.updateId.length <= 200
  const validLevels = levels => isObject(levels) && Object.values(levels).every(level => count(level) && level <= 3)
  const validKeys = keys => Array.isArray(keys) && keys.every(key => typeof key === 'string')
  const validSummary = summary => summary === null || (isObject(summary) && count(summary.round) && summary.round > 0 && validLevels(summary.startLevels) && validLevels(summary.endLevels) && validKeys(summary.wrongKeys))
  return Object.values(value.cards).every(item => isObject(item) && count(item.level) && item.level <= 3 && ['correct', 'wrong'].includes(item.lastResult) && validStamp(item) &&
    (item.lastReviewedAt === undefined || (date(item.lastReviewedAt) && Date.parse(item.lastReviewedAt) <= Date.parse(item.updatedAt))) &&
    (item.needsRecheck === undefined || (item.needsRecheck === true && item.level === 2 && item.lastResult === 'wrong'))) &&
    Object.values(value.nodes).every(item => isObject(item) && count(item.round) && item.round > 0 && count(item.completedRounds) && count(item.answered) && count(item.total) && Array.isArray(item.queue) && item.queue.every(key => typeof key === 'string') && isObject(item.requeues) && Object.values(item.requeues).every(n => count(n) && n <= 2) && Array.isArray(item.advanced) && item.advanced.every(key => typeof key === 'string') && (item.feedback === null || (isObject(item.feedback) && typeof item.feedback.key === 'string' && typeof item.feedback.correct === 'boolean' && count(item.feedback.previousLevel) && item.feedback.previousLevel <= 3 && count(item.feedback.level) && item.feedback.level <= 3)) && (item.roundStartLevels === undefined || validLevels(item.roundStartLevels)) && (item.wrongKeys === undefined || validKeys(item.wrongKeys)) && (item.summary === undefined || validSummary(item.summary)) && validStamp(item))
}

export function newerMasteryRecord(left, right) {
  if (!left) return right
  if (!right) return left
  const delta = Date.parse(left.updatedAt) - Date.parse(right.updatedAt)
  if (delta) return delta > 0 ? left : right
  return left.updateId >= right.updateId ? left : right
}
export function mergeMasteryProgress(left = {}, right = {}) {
  const mergeRecords = (a = {}, b = {}) => Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map(key => [key, newerMasteryRecord(a[key], b[key])]))
  return { cards: mergeRecords(left.cards, right.cards), nodes: mergeRecords(left.nodes, right.nodes) }
}
