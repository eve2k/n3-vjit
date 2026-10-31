import { parseQuestionMarkup } from '../utils/questionMarkup.js'
import useFurigana from '../hooks/useFurigana.js'
import { useLocation } from 'react-router-dom'

export default function QuestionText({ text, hideFurigana = false }) {
  const [visible] = useFurigana()
  const location = useLocation()
  hideFurigana = hideFurigana || location.pathname.startsWith('/study/kanji/') || /\[\[[^[\]]+\]\]/.test(String(text))
  return parseQuestionMarkup(text).map((part, index) => part.reading ? visible && !hideFurigana ? <ruby key={index}>{part.text}<rt>{part.reading}</rt></ruby> : part.text : part.marked ? <span className="question-underline" key={index}>{part.text}</span> : part.text)
}
