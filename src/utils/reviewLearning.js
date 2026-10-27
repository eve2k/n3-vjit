import { dokkai } from '../data/dokkai.js'
import { cardKey, needsRecheck } from './masteryLearning.js'
import { stages, stageQuestions, lessonQuestions, masteryStage, nodeId } from './roadmapContent.js'
import { canonicalReviewKey, latestAnswer } from './reviewQuestionIds.js'
import { usableQuestion } from './questionUsability.js'

export const REVIEW_MODES = ['multiple-choice', 'true-false', 'written']
export const normalizeWrittenAnswer = text => String(text ?? '').normalize('NFKC').trim()
export const correctAnswerText = question => question.options?.[question.correctAnswer]
export const supportsWritten = stageId => ['kanji', 'vocab', 'forms'].includes(stageId)
const usable = usableQuestion
const catalogCache = new Map()

export function reviewCatalog(stageId) {
  if (catalogCache.has(stageId)) return catalogCache.get(stageId)
  const stage = stages.find(item => item.id === stageId && !item.last)
  if (!stage) return []
  // Reading lessons follow actual passages, not fixed four-question slices.
  if (stageId === 'reading') {
    const catalog = dokkai.flatMap(passage => passage.questions.map(question => ({
    ...question, section: 'dokkai', lessonId: passage.id, lessonTitle: passage.titleVi,
    passageText: passage.passage, key: `dokkai:${question.id}`,
    })))
    catalogCache.set(stageId, catalog)
    return catalog
  }
  const groups = new Map(stage.lessons.flatMap((title, index) => lessonQuestions(stage, index).map(q =>
    [cardKey(q), { lessonId: nodeId(index), lessonTitle: title }])))
  const catalog = stageQuestions(stage).map(question => ({ ...question, ...groups.get(cardKey(question)), key: cardKey(question) }))
  catalogCache.set(stageId, catalog)
  return catalog
}

export function eligibleReviewCards(stageId, mastery = {}, results = {}, { lessonIds = null, retryKeys = null } = {}) {
  const stage = stages.find(item => item.id === stageId)
  if (!stage || stage.last) return []
  const retry = retryKeys === null ? null : new Set(retryKeys.map(canonicalReviewKey))
  const seen = new Set()
  return reviewCatalog(stageId).filter(question => {
    if (!usable(question) || seen.has(question.key) || (lessonIds !== null && !lessonIds.includes(question.lessonId))) return false
    seen.add(question.key)
    const card = mastery.cards?.[question.key]
    if (retry) return retry.has(question.key) && (masteryStage(stage) ? needsRecheck(card) : latestAnswer(results, question.key)?.correct === false)
    return masteryStage(stage) ? card?.level === 3 : latestAnswer(results, question.key)?.correct === true
  })
}

function shuffled(values, random) {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function selectReviewCards(pool, { count = Math.min(10, pool.length), prioritizeOld = false, mastery = {}, results = {}, random = Math.random } = {}) {
  const unique = [...new Map(pool.map(question => [canonicalReviewKey(question.key || cardKey(question)), question])).values()]
  if (!Number.isInteger(count) || count < 1 || count > unique.length) throw new Error('Số câu vượt quá phạm vi kiểm tra.')
  const selected = shuffled(unique, random)
  if (prioritizeOld) {
    const reviewedAt = q => {
      const key = canonicalReviewKey(q.key || cardKey(q))
      return Date.parse(mastery.cards?.[key]?.lastReviewedAt || latestAnswer(results, key)?.lastReviewedAt || '') || 0
    }
    selected.sort((a, b) => reviewedAt(a) - reviewedAt(b))
  }
  return selected.slice(0, count)
}

export function createReviewItems(questions, mode, stageId, random = Math.random) {
  if (!REVIEW_MODES.includes(mode) || (mode === 'written' && !supportsWritten(stageId))) throw new Error('Chế độ kiểm tra không phù hợp với chặng.')
  if (!questions.length || questions.some(q => !usable(q))) throw new Error('Không có đủ câu hỏi hợp lệ: đáp án thiếu hoặc lựa chọn trùng.')
  const trueCount = Math.floor(questions.length / 2) + (questions.length % 2 && random() < .5 ? 1 : 0)
  const truths = shuffled(questions.map((_, index) => index < trueCount), random)
  return questions.map((question, index) => {
    const key = canonicalReviewKey(question.key || cardKey(question))
    if (mode === 'written') return { key, mode }
    if (mode === 'multiple-choice') return { key, mode, choices: shuffled(Object.keys(question.options), random) }
    const correctText = normalizeWrittenAnswer(correctAnswerText(question))
    const wrong = Object.keys(question.options).filter(letter => normalizeWrittenAnswer(question.options[letter]) !== correctText)
    if (!wrong.length) throw new Error('Câu hỏi thiếu lựa chọn sai để tạo câu Đúng/Sai.')
    return { key, mode, candidate: truths[index] ? question.correctAnswer : wrong[Math.floor(random() * wrong.length)] }
  })
}

export function gradeReviewAnswer(item, question, response, selfCorrected = false) {
  if (!usable(question) || canonicalReviewKey(item.key) !== canonicalReviewKey(question.key || cardKey(question))) throw new Error('Câu hỏi kiểm tra không hợp lệ.')
  if (selfCorrected && item.mode !== 'written') throw new Error('Chỉ tự luận hỗ trợ tự xác nhận.')
  if (item.mode === 'written') {
    if (typeof response !== 'string') throw new Error('Câu trả lời không hợp lệ.')
    return selfCorrected || normalizeWrittenAnswer(response) === normalizeWrittenAnswer(correctAnswerText(question))
  }
  if (item.mode === 'true-false') {
    if (typeof response !== 'boolean' || !Object.hasOwn(question.options, item.candidate)) throw new Error('Câu trả lời không hợp lệ.')
    return response === (normalizeWrittenAnswer(question.options[item.candidate]) === normalizeWrittenAnswer(correctAnswerText(question)))
  }
  if (item.mode !== 'multiple-choice' || !item.choices?.includes(response)) throw new Error('Câu trả lời không hợp lệ.')
  return response === question.correctAnswer
}
