export const normalizedOption = value => String(value ?? '').normalize('NFKC').trim()

export function usableQuestion(question) {
  const options = question?.options
  if (!options || !Object.hasOwn(options, question.correctAnswer)) return false
  const values = Object.values(options)
  const normalized = values.map(normalizedOption)
  return values.length >= 2 && values.every(value => typeof value === 'string') &&
    normalized.every(Boolean) && new Set(normalized).size === normalized.length
}
