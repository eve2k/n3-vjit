import { useEffect, useState } from 'react'
import { Pause, Play, RotateCcw, SkipForward, Timer } from 'lucide-react'
import { nextPomodoroStage, POMODORO_DEFAULTS, POMODORO_LIMITS } from '../utils/pomodoro.js'

const STAGE_LABELS = { focus: 'Tập trung học', short: 'Nghỉ ngắn', long: 'Nghỉ dài' }
const duration = (settings, kind) => settings[kind] * 60_000
const formatTime = (milliseconds) => {
  const seconds = Math.ceil(milliseconds / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export default function PomodoroTimer({ onStageChange }) {
  const [settings, setSettings] = useState(POMODORO_DEFAULTS)
  const [stage, setStage] = useState({ kind: 'focus', status: 'idle', remainingMs: duration(POMODORO_DEFAULTS, 'focus'), deadline: null, completed: 0 })
  const [now, setNow] = useState(Date.now)
  const [announcement, setAnnouncement] = useState('')
  const remaining = stage.status === 'running' ? Math.max(0, stage.deadline - now) : stage.remainingMs

  useEffect(() => {
    if (stage.status !== 'running') return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [stage.status, stage.deadline])

  useEffect(() => { onStageChange?.({ kind: stage.kind, status: stage.status }) }, [stage.kind, stage.status, onStageChange])

  useEffect(() => {
    if (stage.status !== 'running' || remaining > 0) return
    const next = nextPomodoroStage(stage.kind, stage.completed, settings.longEvery)
    const nextDuration = duration(settings, next.kind)
    setAnnouncement(stage.kind === 'focus' ? `${STAGE_LABELS[next.kind]} bắt đầu.` : 'Bắt đầu phiên tập trung tiếp theo.')
    setStage({ ...next, status: 'running', remainingMs: nextDuration, deadline: Date.now() + nextDuration })
  }, [stage, remaining, settings])

  const start = () => {
    const time = Date.now()
    setNow(time)
    setStage(current => ({ ...current, status: 'running', deadline: time + current.remainingMs }))
    setAnnouncement('Pomodoro đã bắt đầu.')
  }

  const pause = () => {
    const remainingMs = Math.max(0, stage.deadline - Date.now())
    setStage(current => ({ ...current, status: 'paused', remainingMs, deadline: null }))
    setAnnouncement('Đã tạm dừng Pomodoro.')
  }

  const advance = () => {
    const next = nextPomodoroStage(stage.kind, stage.completed, settings.longEvery)
    const nextDuration = duration(settings, next.kind)
    setStage({ ...next, status: 'running', remainingMs: nextDuration, deadline: Date.now() + nextDuration })
    setAnnouncement(`${STAGE_LABELS[next.kind]} bắt đầu.`)
  }

  const reset = () => {
    setStage({ kind: 'focus', status: 'idle', remainingMs: duration(settings, 'focus'), deadline: null, completed: 0 })
    setAnnouncement('Đã đặt lại Pomodoro.')
  }

  const changeSetting = (name, value) => {
    const [min, max] = POMODORO_LIMITS[name]
    const next = Math.max(min, Math.min(max, Number(value) || min))
    setSettings(current => ({ ...current, [name]: next }))
    if (stage.status === 'idle' && name === 'focus') setStage(current => ({ ...current, remainingMs: next * 60_000 }))
  }

  return <section className="panel pomodoro-panel" aria-labelledby="pomodoro-title">
    <div className="pomodoro-heading"><span className="feature-icon"><Timer size={20} aria-hidden="true" /></span><div><h2 id="pomodoro-title">Pomodoro</h2><p>Đồng hồ chạy riêng; bạn có thể học tiếp trong giờ nghỉ.</p></div><span className="pomodoro-completed">{stage.completed} phiên</span></div>
    <div className="pomodoro-clock" aria-label={`${STAGE_LABELS[stage.kind]}, ${formatTime(remaining)} còn lại`}>{formatTime(remaining)}</div>
    <p className="pomodoro-stage" aria-live="polite">{STAGE_LABELS[stage.kind]}{stage.status === 'paused' ? ' · Đã tạm dừng' : stage.status === 'idle' ? ' · Chưa bắt đầu' : ''}</p>
    <div className="pomodoro-controls">
      {stage.status === 'running' ? <button type="button" className="btn btn-secondary" onClick={pause}><Pause size={16} aria-hidden="true" />Tạm dừng</button> : <button type="button" className="btn btn-primary" onClick={start}><Play size={16} aria-hidden="true" />{stage.status === 'paused' ? 'Tiếp tục' : 'Bắt đầu'}</button>}
      <button type="button" className="btn btn-secondary" disabled={stage.status === 'idle'} onClick={advance}><SkipForward size={16} aria-hidden="true" />Bỏ qua</button>
      <button type="button" className="btn btn-secondary" onClick={reset}><RotateCcw size={16} aria-hidden="true" />Đặt lại</button>
    </div>
    <details className="pomodoro-settings"><summary>Điều chỉnh thời lượng</summary><div className="pomodoro-settings-grid">
      <DurationInput label="Học (phút)" value={settings.focus} limits={POMODORO_LIMITS.focus} disabled={stage.status === 'running'} onChange={value => changeSetting('focus', value)} />
      <DurationInput label="Nghỉ ngắn (phút)" value={settings.short} limits={POMODORO_LIMITS.short} disabled={stage.status === 'running'} onChange={value => changeSetting('short', value)} />
      <DurationInput label="Nghỉ dài (phút)" value={settings.long} limits={POMODORO_LIMITS.long} disabled={stage.status === 'running'} onChange={value => changeSetting('long', value)} />
      <DurationInput label="Nghỉ dài sau số phiên" value={settings.longEvery} limits={POMODORO_LIMITS.longEvery} disabled={stage.status === 'running'} onChange={value => changeSetting('longEvery', value)} />
    </div></details>
    <span className="sr-only" aria-live="assertive">{announcement}</span>
  </section>
}

function DurationInput({ label, value, limits, disabled, onChange }) {
  return <label>{label}<input type="number" min={limits[0]} max={limits[1]} step="1" value={value} disabled={disabled} onChange={event => onChange(event.target.value)} /></label>
}
