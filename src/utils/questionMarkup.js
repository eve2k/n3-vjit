export function parseQuestionMarkup(text = '') {
  return String(text).split(/(\[\[[^[\]]+\]\]|\{[^{}|\n]+\|[^{}|\n]+\})/g).filter(Boolean).map(part => {
    if (part.startsWith('[[') && part.endsWith(']]')) return { text: part.slice(2, -2), marked: true }
    if (/^\{[^{}|\n]+\|[^{}|\n]+\}$/.test(part)) {
      const [base, reading] = part.slice(1, -1).split('|')
      return { text: base, reading }
    }
    return { text: part, marked: false }
  })
}
export const plainQuestionText = text => parseQuestionMarkup(text).map(part => part.text).join('')
export function questionInstruction(question) {
  if (question?.section !== 'renshuu3' || !/\[\[[^[\]]+\]\]/.test(question.questionText || '')) return 'Chọn đáp án đúng'
  return question.part === 'A' ? 'Chọn cách đọc của từ gạch chân' : 'Chọn chữ kanji của từ gạch chân'
}
