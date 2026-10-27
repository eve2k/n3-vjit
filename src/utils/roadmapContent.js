import { QUIZ_SECTIONS, dokkai } from '../data/index.js'
import { needsConsolidation, needsRecheck } from './masteryLearning.js'
import { usableQuestion } from './questionUsability.js'

const section = id => QUIZ_SECTIONS.find(item => item.id === id)
const questionPool = id => id === 'dokkai'
  ? dokkai.flatMap(reading => reading.questions.map(question => ({ ...question, section: 'dokkai', passageText: reading.passage, contextTitle: reading.titleVi })))
  : section(id)?.questions || []
export const stages = [
  { id: 'kanji', title: 'Kanji', source: ['renshuu3'], unit: '5 câu', perLesson: 5, lessons: [...Array.from({ length: 5 }, (_,i) => `Đọc ${i+1}`), ...Array.from({ length: 5 }, (_,i) => `Viết ${i+1}`)] },
  { id: 'vocab', title: 'Từ vựng', source: ['renshuu2', 'fukushuu1'], unit: 'câu', perLesson: 11, lessons: [...Array.from({ length: 4 }, (_,i) => `Từ vựng ${i+1}`), ...Array.from({ length: 6 }, (_,i) => `Đồng nghĩa ${i+1}`)] },
  { id: 'forms', title: 'Chia thể', source: ['renshuu5'], unit: '10 câu', perLesson: 10, lessons: ['Dạng て, た', 'Dạng ない, ずに', 'Bị động, sai khiến', 'Thể ý chí', 'Tổng hợp'] },
  { id: 'grammar', title: 'Ngữ pháp', source: ['renshuu4'], unit: '8 câu', perLesson: 8, lessons: ['Nguyên nhân', 'Đối lập', 'ばかり, しか', 'にかけて, によって', 'ようがない', 'Tổng hợp'] },
  { id: 'reading', title: 'Đọc hiểu', source: ['dokkai'], unit: '1 bài đọc', perLesson: 4, lessons: Array.from({ length: 10 }, (_,i) => `Bài ${i+1}`) },
  { id: 'exam', title: 'Thi thử', source: [], unit: 'toàn phần', perLesson: 1, lessons: ['Đề 1', 'Đề 2', 'Đề 3'], last: true },
]
export const stageQuestions = stage => stage.source.flatMap(questionPool)
export const lessonQuestions = (stage, index) => {
  if (stage.id === 'vocab') {
    const isVocabulary = index < 4
    const pool = questionPool(isVocabulary ? 'renshuu2' : 'fukushuu1')
    const count = isVocabulary ? 4 : 6
    const position = isVocabulary ? index : index - 4
    if (position < 0 || position >= count) return []
    const base = Math.floor(pool.length / count)
    const extra = pool.length % count
    const start = position * base + Math.min(position, extra)
    return pool.slice(start, start + base + (position < extra ? 1 : 0))
  }
  return stageQuestions(stage).slice(index * stage.perLesson, (index + 1) * stage.perLesson)
}
export const nodesFor = stage => [...stage.lessons.map((title, index) => ({ kind: 'lesson', title, index })), ...(stage.last ? [] : [{ kind: 'checkpoint', title: 'Kiểm tra chặng' }]), { kind: 'end', title: stage.last ? 'Hết lộ trình' : 'Chặng tiếp' }]


export const masteryStage = stage => ['kanji', 'vocab', 'forms'].includes(stage?.id)
export const nodeId = index => `lesson-${index + 1}`
export function findLesson(stageId, id) {
  const stage = stages.find(item => item.id === stageId && masteryStage(item))
  const match = /^lesson-([1-9][0-9]*)$/.exec(id || '')
  const index = match ? Number(match[1]) - 1 : -1
  return stage && index >= 0 && index < stage.lessons.length && lessonQuestions(stage, index).length ? { stage, index, questions: lessonQuestions(stage, index) } : null
}

// Only include nodes the learner has started, not the entire unseen syllabus.
export function weakMasteryNodes(progress) {
  const cards = progress?.cards || {}
  const sessions = progress?.nodes || {}
  return stages.filter(masteryStage).flatMap(stage => stage.lessons.flatMap((title, index) => {
    const questions = lessonQuestions(stage, index).filter(usableQuestion)
    const started = sessions[`${stage.id}:${nodeId(index)}`] || questions.some(q => cards[`${q.section}:${q.id}`])
    if (!started) return []
    const weak = questions.filter(q => needsConsolidation(cards[`${q.section}:${q.id}`]))
    const recheckQuestions = weak.filter(q => needsRecheck(cards[`${q.section}:${q.id}`]))
    return weak.length ? [{ stage, index, title, questions: weak, recheckQuestions }] : []
  }))
}

export const weakMasteryCount = progress => weakMasteryNodes(progress).reduce((sum, node) => sum + node.questions.length, 0)

export function cardLevelCounts(questions, cards = {}) {
  const counts = [0, 0, 0, 0]
  let unseen = 0
  for (const q of questions) { const card = cards[`${q.section}:${q.id}`]; if (!card) unseen++; else counts[card.level]++ }
  return { counts, unseen, total: questions.length }
}

export function stageProgress(stage, completed = {}, mastery = {}) {
  const cards = mastery.cards || {}
  const sessions = mastery.nodes || {}
  const counts = [0, 0, 0, 0]
  let passed = 0
  let unseen = 0
  let total = 0
  for (let index = 0; index < stage.lessons.length; index++) {
    const questions = lessonQuestions(stage, index).filter(usableQuestion)
    if (!questions.length) continue
    if (masteryStage(stage)) {
      const levels = questions.map(q => cards[`${q.section}:${q.id}`]?.level ?? 0)
      const distribution = cardLevelCounts(questions, cards)
      distribution.counts.forEach((value, level) => { counts[level] += value })
      unseen += distribution.unseen
      total += distribution.total
      if (levels.filter(level => level >= 2).length / levels.length >= .8 || (sessions[`${stage.id}:${nodeId(index)}`]?.completedRounds || 0) >= 3) passed++
    } else if (questions.every(q => (completed[q.section] || []).includes(q.id))) passed++
  }
  return { counts, unseen, total, passed, lessons: stage.lessons.length }
}

export function continueLessonIndex(stage, completed = {}, mastery = {}) {
  if (stage.last) return 0
  const cards = mastery.cards || {}
  const sessions = mastery.nodes || {}
  if (masteryStage(stage)) {
    const ongoing = stage.lessons.map((_, index) => {
      const questions = lessonQuestions(stage, index).filter(usableQuestion)
      const session = sessions[`${stage.id}:${nodeId(index)}`]
      return session && questions.length && questions.some(q => (cards[`${q.section}:${q.id}`]?.level ?? 0) < 3) ? { index, updatedAt: session.updatedAt || '' } : null
    }).filter(Boolean).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.index - b.index)
    if (ongoing.length) return ongoing[0].index
  }
  const index = stage.lessons.findIndex((_, lessonIndex) => {
    const questions = lessonQuestions(stage, lessonIndex).filter(usableQuestion)
    if (!questions.length) return false
    if (!masteryStage(stage)) return questions.some(q => !(completed[q.section] || []).includes(q.id))
    const levels = questions.map(q => cards[`${q.section}:${q.id}`]?.level ?? 0)
    return levels.filter(level => level >= 2).length / levels.length < .8 && (sessions[`${stage.id}:${nodeId(lessonIndex)}`]?.completedRounds || 0) < 3
  })
  return index < 0 ? 0 : index
}
