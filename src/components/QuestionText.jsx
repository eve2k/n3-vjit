import { parseQuestionMarkup } from '../utils/questionMarkup.js'

export default function QuestionText({ text }) {
  return parseQuestionMarkup(text).map((part, index) => part.marked ? <span className="question-underline" key={index}>{part.text}</span> : part.text)
}
