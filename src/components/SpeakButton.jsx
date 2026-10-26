import { Volume2 } from 'lucide-react'
import { speakJapanese, stopSpeaking } from '../utils/tts'

export default function SpeakButton({ text, rate = 0.9, className = '' }) {
  if (!text) return null
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 rounded border border-[var(--line)] px-2 py-1 text-xs hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] ${className}`}
      onClick={() => {
        stopSpeaking()
        speakJapanese(text, rate)
      }}
      aria-label="Phát âm tiếng Nhật"
    >
      <Volume2 size={14} />
      TTS
    </button>
  )
}
