export const ADVANCE_DELAY_MS = 500
const editableSelector = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'

export function shouldIgnoreStudyShortcut(event) {
  return Boolean(event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.target?.isContentEditable || event.target?.closest?.(editableSelector))
}

export function handleStudyShortcut(event, state, now = Date.now()) {
  if (event.repeat && state.answered && event.target?.closest?.('[data-shortcut-advance]') && (event.key === 'Enter' || event.key === ' ' || event.code === 'Space' || event.code === 'NumpadEnter')) { event.preventDefault(); return true }
  if (shouldIgnoreStudyShortcut(event) || state.disabled) return false
  const key = event.key
  const number = /^Numpad[1-4]$/.test(event.code || '') ? Number(event.code.slice(-1)) : /^[1-4]$/.test(key) ? Number(key) : 0
  const enter = key === 'Enter' || event.code === 'NumpadEnter'
  const space = key === ' ' || event.code === 'Space'
  const interactive = event.target?.closest?.('button, a, summary, [role="button"]')
  const advanceButton = event.target?.closest?.('[data-shortcut-advance]')
  const call = action => { event.preventDefault(); action?.(); return true }
  if (state.helpOpen) return key === 'Escape' || key === '?' ? call(state.onHelp) : false
  if (key === '?' && state.onHelp) return call(state.onHelp)
  if (key === 'Escape') return call(state.onExit)
  if (state.mode === 'preview') return enter && !interactive && state.onStart ? call(state.onStart) : false
  if (key.toLowerCase() === 's' && state.onSpeak) return call(state.onSpeak)
  if (number && !state.answered && state.onChoose && number <= state.optionCount) return call(() => state.onChoose(number - 1))
  if ((enter || space) && state.answered && state.onAdvance && (!interactive || advanceButton)) {
    event.preventDefault()
    if (Number.isFinite(state.answeredAt) && now - state.answeredAt >= ADVANCE_DELAY_MS) state.onAdvance()
    return true
  }
  return false
}
