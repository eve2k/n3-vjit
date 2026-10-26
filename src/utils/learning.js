import { allQuizQuestions, quizSections, dokkai, choukai } from '../data/index.js'

export function getSectionProgress(section, completed = {}) {
  const ids = new Set(completed[section.id] || [])
  return section.questions.filter((question) => ids.has(question.id)).length
}

export function getQuizProgress(completed = {}) {
  return quizSections.reduce((total, section) => total + getSectionProgress(section, completed), 0)
}

export function getContinueLesson(completed = {}, lastLesson = null) {
  const preferred = quizSections.find((section) => section.id === lastLesson?.sectionId)
  const ordered = preferred ? [preferred, ...quizSections.filter((section) => section !== preferred)] : quizSections
  for (const section of ordered) {
    const done = new Set(completed[section.id] || [])
    const last = section.questions.find((question) => question.id === lastLesson?.questionId && !done.has(question.id))
    const question = last || section.questions.find((item) => !done.has(item.id))
    if (question) return { section, question }
  }
  return null
}

export const reviewQuestions = [
  ...allQuizQuestions,
  ...dokkai.flatMap((passage) => passage.questions.map((question) => ({
    ...question,
    section: question.section || passage.id,
    passageText: passage.passage,
    contextTitle: `Đọc hiểu · Bài ${passage.number}`,
  }))),
  ...Object.entries(choukai).flatMap(([group, questions]) => Array.isArray(questions) ? questions
    .filter((question) => question.correctAnswer && Object.keys(question.options || {}).length)
    .map((question) => ({
      ...question,
      section: question.section || group,
      questionText: question.questionText || question.situation || question.prompt || 'Chọn câu trả lời phù hợp.',
      questionNumber: question.questionNumber || question.n,
      contextTitle: 'Luyện nghe',
    })) : []),
]

export function getMistakeQuestions(wrong = {}) {
  return reviewQuestions.filter((question) => Object.hasOwn(wrong[question.section] || {}, question.id))
}

export function gradeExam(questions, answers) {
  const answered = questions.filter((question) => Object.hasOwn(question.options, answers[question.id]))
  return {
    total: questions.length,
    answered: answered.length,
    unanswered: questions.length - answered.length,
    correct: answered.filter((question) => String(answers[question.id]) === String(question.correctAnswer)).length,
  }
}

export function formatDuration(seconds = 0) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}
