import { dokkai } from '../data/dokkai.js'

// Explicit pairs from the source bank: /dokkai used passage IDs, the roadmap
// used "dokkai". Resolve aliases at read time; never rewrite saved IDs.
export const READING_ID_MAP = Object.freeze(Object.fromEntries(dokkai.flatMap(passage =>
  passage.questions.map(question => [`${question.section || passage.id}:${question.id}`, `dokkai:${question.id}`]))))

const aliases = new Map()
for (const [oldKey, newKey] of Object.entries(READING_ID_MAP)) {
  aliases.set(newKey, [...new Set([...(aliases.get(newKey) || [newKey]), oldKey])])
}
export const canonicalReviewKey = key => Object.hasOwn(READING_ID_MAP, key) ? READING_ID_MAP[key] : key
export const reviewKeyAliases = key => [...(aliases.get(canonicalReviewKey(key)) || [key])]

export function latestAnswerEntry(results = {}, key) {
  let entry = null
  for (const alias of reviewKeyAliases(key)) {
    const value = results[alias]
    if (!value) continue
    const delta = entry ? Date.parse(value.answeredAt) - Date.parse(entry.value.answeredAt) : 1
    if (!entry || delta > 0 || (delta === 0 && value.updateId > entry.value.updateId)) entry = { key: alias, value }
  }
  return entry
}

export const latestAnswer = (results, key) => latestAnswerEntry(results, key)?.value
