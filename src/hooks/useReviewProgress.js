import { useMemo, useSyncExternalStore } from 'react'
import { getMasteryProgress, getReviewProgress } from '../utils/storage.js'

const subscribe = callback => {
  const events = ['n3vjit:progress-write', 'n3vjit:progress', 'storage']
  events.forEach(event => window.addEventListener(event, callback))
  return () => events.forEach(event => window.removeEventListener(event, callback))
}
const snapshot = () => JSON.stringify({ mastery: getMasteryProgress(), review: getReviewProgress() })
const empty = () => '{"mastery":{"cards":{},"nodes":{}},"review":{"results":{},"session":null}}'

export default function useReviewProgress() {
  const value = useSyncExternalStore(subscribe, snapshot, empty)
  return useMemo(() => JSON.parse(value), [value])
}
