import { useEffect, useRef, useState } from 'react'
import { plainQuestionText } from '../utils/questionMarkup.js'
import { Square, Volume2 } from 'lucide-react'
import { speakJapanese, stopSpeaking } from '../utils/tts'

export default function SpeakButton({ text, rate = 0.9, className = '', shortcuts, label = 'Phát âm' }) {
  const [playing, setPlaying] = useState(false)
  const previousText = useRef(text)
  useEffect(() => {
    if (previousText.current === text) return
    previousText.current = text
    if (playing) stopSpeaking()
  }, [text, playing])
  if (!text) return null
  return (
    <button
      type="button"
      className={`speak-button inline-flex items-center gap-2 rounded border border-[var(--line)] px-3 py-2 text-sm hover:bg-[var(--accent-soft)] ${playing ? 'is-playing' : ''} ${className}`}
      onClick={() => {
        if (playing) { stopSpeaking(); return }
        if (!window.speechSynthesis) return
        setPlaying(true)
        speakJapanese(plainQuestionText(text), rate, () => setPlaying(false))
      }}
      aria-label={playing ? 'Dừng phát âm' : label}
      aria-pressed={playing}
      aria-keyshortcuts={shortcuts}
    >
      {playing ? <Square size={15} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
      {playing ? 'Dừng phát' : label}
    </button>
  )
}
