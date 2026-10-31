import { useSyncExternalStore } from 'react'

const KEY = 'n3vjit_show_furigana'
const EVENT = 'n3vjit:furigana'
const subscribe = callback => {
  window.addEventListener(EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}
const snapshot = () => {
  try { return localStorage.getItem(KEY) !== 'false' } catch { return true }
}

export default function useFurigana() {
  const visible = useSyncExternalStore(subscribe, snapshot, () => true)
  const toggle = () => {
    try { localStorage.setItem(KEY, String(!snapshot())) } catch { return }
    window.dispatchEvent(new Event(EVENT))
  }
  return [visible, toggle]
}
