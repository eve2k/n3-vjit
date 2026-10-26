import { mergeProgress } from './mergeProgress.js'

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
export function sameProgress(left, right) {
  if (left === right) return true
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => sameProgress(value, right[index]))
  if (!record(left) || !record(right)) return false
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameProgress(left[key], right[key]))
}

// Acknowledged baseline distinguishes unsent edits from an old device cache.
// Deletions and unmastered cards propagate instead of being resurrected by unions.
export function reconcileProgress(base, local, remote) {
  if (base === null) {
    if (!Object.keys(local).length) return remote
    if (!Object.keys(remote).length) return local
    return mergeProgress(remote, local)
  }
  function merge(before, here, there, path = '') {
    if (sameProgress(here, before)) return there
    if (sameProgress(there, before) || sameProgress(here, there)) return here
    if (path === 'n3vjit_lastLesson') return here
    if (path.startsWith('n3vjit_customSakubun.')) {
      if (!here || !there) return here
      return Date.parse(there.updatedAt) > Date.parse(here.updatedAt) ? there : here
    }
    if (path === 'n3vjit_quizHistory' && Array.isArray(here) && Array.isArray(there)) {
      const keyed = list => Object.fromEntries((list || []).map(item => [item.id || JSON.stringify([item.date, item.mode, item.total, item.correct, item.elapsed]), item]))
      return Object.values(merge(keyed(before), keyed(here), keyed(there), 'history')).sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    }
    if (path.startsWith('history.')) return here
    if (Array.isArray(here) && Array.isArray(there)) {
      const old = new Set(before || [])
      return [...new Set([...there, ...here])].filter(value => !old.has(value) || (here.includes(value) && there.includes(value)))
    }
    if (record(here) && record(there)) {
      const merged = Object.create(null)
      for (const key of new Set([...Object.keys(before || {}), ...Object.keys(here), ...Object.keys(there)])) {
        const value = merge(before?.[key], here[key], there[key], path ? `${path}.${key}` : key)
        if (value !== undefined) merged[key] = value
      }
      return merged
    }
    return here
  }
  return merge(base, local, remote)
}
