import { gradeExam } from './learning.js'
import { addQuizResult, addWrongQuestion, markQuestionCompleted, markWrongQuestionCorrect } from './storage.js'

export function recordExamAttempt(questions, answers, elapsed) {
  const result = { ...gradeExam(questions, answers), mode: 'exam', elapsed }
  for (const question of questions) {
    const choice = answers[question.id]
    if (!Object.hasOwn(question.options, choice)) continue
    markQuestionCompleted(question.section, question.id)
    if (String(choice) === String(question.correctAnswer)) markWrongQuestionCorrect(question.section, question.id)
    else addWrongQuestion(question.section, question.id)
  }
  addQuizResult(result)
  return result
}
