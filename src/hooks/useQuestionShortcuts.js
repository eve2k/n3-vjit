import { useEffect, useState } from 'react'
import { handleQuestionShortcut } from '../utils/questionShortcuts.js'

export default function useQuestionShortcuts({ question, answer, locked = false, disabled = false, scope = '', onAnswer, onNext }) {
  const questionKey = `${scope}:${question?.id || ''}`
  const [selection, setSelection] = useState({ key: questionKey, choice: null })
  if (selection.key !== questionKey) setSelection({ key: questionKey, choice: null })
  const pendingChoice = !disabled && !locked && selection.key === questionKey ? selection.choice : null
  const clearPending = () => setSelection({ key: questionKey, choice: null })
  const confirm = (choice) => {
    clearPending()
    onAnswer(choice)
  }

  useEffect(() => {
    const onKeyDown = (event) => handleQuestionShortcut(event, {
      question, answer, pendingChoice, locked, disabled,
      onPick: (choice) => setSelection({ key: questionKey, choice }),
      onConfirm: (choice) => { setSelection({ key: questionKey, choice: null }); onAnswer(choice) },
      onNext: () => { setSelection({ key: questionKey, choice: null }); onNext?.() },
    })
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [question, answer, pendingChoice, locked, disabled, questionKey, onAnswer, onNext])

  return { pendingChoice, confirm, clearPending }
}
