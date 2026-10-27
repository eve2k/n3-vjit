import { dokkai, flashcardDecks } from '../data/index.js'
import { reviewQuestions } from './learning.js'

const answeredQuestions = reviewQuestions.filter(question => question.correctAnswer && question.options && !String(question.id).startsWith('ck'))
const questionById = new Map(answeredQuestions.map(question => [question.id, question]))
const linkedFlashcardId = card => card.id.replace(/^fc\d+_/, '')

export const POMODORO_UNITS = (() => {
  const units = answeredQuestions.map(question => ({
    id: `quiz:${question.section}/${question.id}`,
    kind: 'quiz',
    question,
    flashcard: null,
    title: question.contextTitle || question.section,
  }))
  const byQuestion = new Map(units.map(unit => [unit.question.id, unit]))
  for (const card of Object.values(flashcardDecks).flatMap(deck => deck.cards)) {
    const linkedQuestion = questionById.get(linkedFlashcardId(card))
    if (linkedQuestion) byQuestion.get(linkedQuestion.id).flashcard = card
    else units.push({ id: `flashcard:${card.id}`, kind: 'flashcard', question: null, flashcard: card, title: `Flashcard · Bộ ${card.deck}` })
  }
  return units
})()

function hash(text) {
  let value = 2166136261
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619)
  return value >>> 0
}

function features(events, unitId, gap, contentType = null) {
  const own = events.filter(event => event.unitId === unitId).sort((a, b) => a.at.localeCompare(b.at))
  let streak = 0
  let misses = 0
  let correct = 0
  for (const event of own) {
    if (event.correct) { streak += 1; correct += 1 } else { streak = 0; misses += 1 }
  }
  const kind = contentType || own.at(-1)?.contentType
  return [1, Math.log1p(gap), Math.min(streak, 5) / 5, Math.min(misses, 5) / 5, own.length ? correct / own.length : 0.5, kind === 'flashcard' || unitId.startsWith('flashcard:') ? 1 : 0, kind === 'reading' || /quiz:dk\d+\//.test(unitId) ? 1 : 0]
}

export function estimatePomodoroRecall(events, unitId, gap, contentType = null) {
  const weights = [-0.15, -0.38, 0.55, -0.2, 0.35, 0.05, 0.05]
  const ordered = [...events].sort((a, b) => a.at.localeCompare(b.at))
  const observed = new Map()
  for (const event of ordered) {
    const x = features([...observed.values()], event.unitId, Math.max(1, (Date.parse(event.at) - (Date.parse(observed.get(event.unitId)?.at) || Date.parse(event.at))) / 3_600_000), event.contentType)
    const prediction = 1 / (1 + Math.exp(-weights.reduce((sum, weight, index) => sum + weight * x[index], 0)))
    const error = Number(event.correct) - prediction
    x.forEach((value, index) => { weights[index] += 0.08 * error * value })
    observed.set(event.unitId, event)
  }
  const x = features(events, unitId, gap, contentType)
  return 1 / (1 + Math.exp(-weights.reduce((sum, weight, index) => sum + weight * x[index], 0)))
}

export function suggestPomodoroGap(events, unitId, correct, contentType = null) {
  const confidence = estimatePomodoroRecall(events, unitId, correct ? 10 : 3, contentType)
  const spread = hash(unitId) % (correct ? 6 : 2)
  if (!correct) return confidence >= 0.65 ? 3 : 2
  return confidence >= 0.75 ? 5 + spread : 5 + Math.floor(spread / 2)
}

export function getPomodoroUnitStatus(unit, events, cycleId) {
  const own = events.filter(event => event.cycleId === cycleId && event.unitId === unit.id).sort((a, b) => a.at.localeCompare(b.at))
  let streak = 0
  for (const event of own) streak = event.correct ? streak + 1 : 0
  return { streak, status: streak >= 2 ? 'mastered' : streak === 1 ? 'familiar' : 'new', attempts: own.length }
}

export function getNextPomodoroUnit(units, progress, cycleId) {
  const events = progress.events.filter(event => event.cycleId === cycleId)
  const step = events.length
  const rank = new Map(units.map((unit, index) => [unit.id, index]))
  const candidates = units.map(unit => {
    const own = events.filter(event => event.unitId === unit.id).sort((a, b) => a.at.localeCompare(b.at))
    const status = getPomodoroUnitStatus(unit, events, cycleId)
    return { unit, own, status, due: own.at(-1)?.dueAtStep ?? -1 }
  }).filter(item => item.status.status !== 'mastered')
  if (!candidates.length) return null
  const due = candidates.filter(item => item.own.length && item.due <= step).sort((a, b) => a.due - b.due || rank.get(a.unit.id) - rank.get(b.unit.id))
  if (due.length) return due[0].unit
  const fresh = candidates.filter(item => !item.own.length).sort((a, b) => rank.get(a.unit.id) - rank.get(b.unit.id))
  if (fresh.length) return fresh[0].unit
  return candidates.sort((a, b) => a.due - b.due || rank.get(a.unit.id) - rank.get(b.unit.id))[0].unit
}

export function pomodoroCycleStats(units, events, cycleId) {
  let familiar = 0
  let mastered = 0
  for (const unit of units) {
    const status = getPomodoroUnitStatus(unit, events, cycleId).status
    if (status === 'familiar') familiar += 1
    if (status === 'mastered') mastered += 1
  }
  return { total: units.length, familiar, mastered, new: units.length - familiar - mastered }
}

export function linkedPomodoroFlashcardCount() {
  return Object.values(flashcardDecks).flatMap(deck => deck.cards).filter(card => questionById.has(linkedFlashcardId(card))).length
}

export function pomodoroContentCounts() {
  return { quiz: answeredQuestions.filter(question => !dokkai.some(passage => passage.questions.some(item => item.id === question.id))).length,
    reading: answeredQuestions.length - answeredQuestions.filter(question => !dokkai.some(passage => passage.questions.some(item => item.id === question.id))).length,
    flashcards: Object.values(flashcardDecks).reduce((sum, deck) => sum + deck.cards.length, 0),
    linkedFlashcards: linkedPomodoroFlashcardCount(), total: POMODORO_UNITS.length }
}
