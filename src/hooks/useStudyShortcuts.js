import { useEffect, useRef } from 'react'
import { handleStudyShortcut } from '../utils/studyShortcuts.js'

export default function useStudyShortcuts(state) {
  const latest = useRef(state)
  latest.current = state
  useEffect(() => {
    const handleKey = event => handleStudyShortcut(event, latest.current)
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])
}
