export function handleQuestionShortcut(event, { question, pendingChoice, answer, locked, disabled, onPick, onConfirm, onNext }) {
  if (disabled || !question || event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false
  const target = event.target
  if (target?.closest?.('input, textarea, select, a, summary, audio, video, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"]')) return false
  if (target?.closest?.('button, [role="button"]') && !target.closest('.answer-option')) return false
  const number = /^[1-4]$/.test(event.key) ? Number(event.key) - 1 : -1
  const space = event.code === 'Space' || event.key === ' '
  if (number < 0 && !space) return false
  const choice = Object.keys(question.options || {})[number]
  if (number >= 0 && (!choice || locked)) return false
  event.preventDefault()
  if (event.repeat) return true
  if (number >= 0) onPick(choice)
  else if (pendingChoice && !locked) onConfirm(pendingChoice)
  else if (answer) onNext?.()
  return true
}
