import QuestionText from './QuestionText.jsx'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { POMODORO_UNITS, getNextPomodoroUnit, getPomodoroUnitStatus, pomodoroContentCounts, pomodoroCycleStats, suggestPomodoroGap } from '../utils/pomodoroLearning.js'
import { getPomodoroLearning, savePomodoroLearning } from '../utils/storage.js'
import { createId } from '../utils/id.js'
import { useAuth } from '../context/authContext.js'
import PomodoroTimer from './PomodoroTimer.jsx'
import SpeakButton from './SpeakButton.jsx'
import useQuestionShortcuts from '../hooks/useQuestionShortcuts.js'

const CONTENT = pomodoroContentCounts()
const emptyProgress = { cycles: [], events: [] }

function activeCycle(progress) {
  const cycles = [...progress.cycles].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return cycles.find(cycle => !cycle.completedAt) || cycles[0] || null
}

export default function PomodoroStudy() {
  const { user, progressVersion } = useAuth()
  const [progress, setProgress] = useState(() => getPomodoroLearning() || emptyProgress)
  const [currentId, setCurrentId] = useState(null)
  const [picked, setPicked] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [notice, setNotice] = useState('')
  const [resting, setResting] = useState(false)
  const cycle = activeCycle(progress)
  const stats = cycle ? pomodoroCycleStats(POMODORO_UNITS, progress.events, cycle.id) : null
  const unit = cycle && stats?.mastered < stats?.total
    ? POMODORO_UNITS.find(item => item.id === currentId) || getNextPomodoroUnit(POMODORO_UNITS, progress, cycle.id)
    : null
  const status = unit && cycle ? getPomodoroUnitStatus(unit, progress.events, cycle.id) : null
  const flashcardMode = Boolean(unit?.flashcard && (!unit.question || status?.streak > 0))
  const question = unit?.question
  const handleStageChange = useCallback(({ kind }) => setResting(kind !== 'focus'), [])

  useEffect(() => { setProgress(getPomodoroLearning() || emptyProgress) }, [progressVersion])

  const persist = next => {
    setProgress(next)
    try { savePomodoroLearning(next); setNotice('') } catch (error) { setNotice(error.message) }
  }

  const startCycle = () => {
    const startedAt = new Date().toISOString()
    const next = { ...progress, cycles: [...progress.cycles, { id: createId(), startedAt, completedAt: null }] }
    persist(next)
    setCurrentId(null); setPicked(null); setFeedback(null); setRevealed(false)
  }

  const answer = correct => {
    if (!unit || !cycle || feedback || resting) return
    const cycleEvents = progress.events.filter(event => event.cycleId === cycle.id)
    const before = getPomodoroUnitStatus(unit, progress.events, cycle.id)
    const time = new Date().toISOString()
    const contentType = flashcardMode ? 'flashcard' : question?.passageText ? 'reading' : 'quiz'
    const gap = before.streak >= 1 && correct ? 1 : suggestPomodoroGap(progress.events, unit.id, correct, contentType)
    const event = { id: createId(), unitId: unit.id, cycleId: cycle.id, contentType, correct, at: time, dueAtStep: cycleEvents.length + 1 + gap }
    const events = [...progress.events, event]
    const nextStatus = getPomodoroUnitStatus(unit, events, cycle.id)
    let cycles = progress.cycles
    if (nextStatus.status === 'mastered' && pomodoroCycleStats(POMODORO_UNITS, events, cycle.id).mastered === POMODORO_UNITS.length) {
      cycles = cycles.map(item => item.id === cycle.id ? { ...item, completedAt: time } : item)
    }
    setCurrentId(unit.id)
    persist({ cycles, events })
    setFeedback({ correct, mastered: nextStatus.status === 'mastered', message: correct ? nextStatus.status === 'mastered' ? 'Thành thạo! Bạn đã trả lời đúng hai lần liên tiếp.' : 'Chính xác! Đơn vị này sẽ quay lại sau một khoảng giãn.' : 'Chưa nhớ chính xác. Đơn vị này sẽ được nhắc lại sớm.' })
  }

  const continueLearning = () => {
    setCurrentId(null); setPicked(null); setFeedback(null); setRevealed(false)
  }

  const { pendingChoice, confirm } = useQuestionShortcuts({
    question, answer: picked, locked: Boolean(feedback), disabled: !cycle || flashcardMode || resting,
    scope: cycle?.id || 'pomodoro',
    onAnswer: letter => { setPicked(letter); answer(String(letter) === String(question?.correctAnswer)) },
    onNext: continueLearning,
  })

  const startAgain = () => startCycle()

  return <div className="page-shell quiz-page focus-study-page pomodoro-study-page">
    <div className="page-heading"><div><p className="eyebrow">HỌC TOÀN BỘ KIẾN THỨC CÓ ĐÁP ÁN</p><h1>Pomodoro học tập</h1><p className="page-description">Ôn câu quiz, đọc hiểu và flashcard theo vòng lặp thích ứng. Câu sai quay lại sớm; câu đúng được giãn cách.</p></div><Link to="/study" className="text-link"><ArrowLeft size={15} aria-hidden="true" />Ôn theo lịch SRS</Link></div>
    <PomodoroTimer onStageChange={handleStageChange} />
    {notice && <p className="notice notice-error" role="alert">{notice}</p>}
    {!user && <p className="auth-field-hint">Khách có thể học trong phiên này; tiến độ sẽ không được lưu sau khi rời trang.</p>}
    {!cycle ? <section className="panel srs-plan pomodoro-course-intro">
      <span className="feature-icon"><Sparkles size={24} aria-hidden="true" /></span><h2>Một vòng học gồm {CONTENT.total} đơn vị</h2>
      <p>{CONTENT.quiz} câu quiz · {CONTENT.reading} câu đọc hiểu · {CONTENT.flashcards} flashcard, trong đó {CONTENT.linkedFlashcards} thẻ được gộp với câu quiz tương ứng. Câu nghe chưa có đáp án, hội thoại tự luận và bài viết không nằm trong vòng tự chấm.</p>
      <p>Mỗi đơn vị chuyển từ <strong>Chưa học</strong> sang <strong>Đang quen</strong> sau một lần đúng, rồi thành <strong>Thành thạo</strong> sau hai lần đúng liên tiếp. Sai sẽ đặt lại trạng thái.</p>
      <button type="button" className="btn btn-primary" onClick={startCycle}><CheckCircle2 size={17} aria-hidden="true" />Bắt đầu vòng học</button>
    </section> : stats.mastered === stats.total ? <section className="panel srs-plan pomodoro-course-intro">
      <span className="feature-icon"><CheckCircle2 size={24} aria-hidden="true" /></span><h2>Hoàn thành toàn bộ {stats.total} đơn vị!</h2><p>Đã thành thạo: {stats.mastered} · Đang quen: {stats.familiar} · Chưa học: {stats.new}</p><button type="button" className="btn btn-primary" onClick={startAgain}><RotateCcw size={17} aria-hidden="true" />Bắt đầu vòng mới</button>
    </section> : <>
      <section className="panel pomodoro-course-progress"><div><strong>{stats.mastered}/{stats.total}</strong><span> đơn vị thành thạo</span></div><div><strong>{stats.familiar}</strong><span> đang quen</span></div><div><strong>{stats.new}</strong><span> chưa học</span></div><div className="progress-track"><span style={{ width: `${stats.mastered / stats.total * 100}%` }} /></div></section>
      <section className={`panel question-card pomodoro-learning-card ${resting ? 'pomodoro-resting' : ''}`} aria-labelledby="pomodoro-question-title">
        {resting && <div className="pomodoro-rest-overlay" role="status">Đang nghỉ Pomodoro · vị trí học được giữ nguyên</div>}
        <div className="question-meta"><span>{unit?.title} · {status?.status === 'familiar' ? 'Đang quen' : 'Chưa học'} · {new Set(progress.events.filter(event => event.cycleId === cycle.id).map(event => event.unitId)).size}/{stats.total} đã gặp</span>{question && <SpeakButton text={question.questionText} />}</div>
        {question?.passageText && <details className="question-context" open><summary>Đoạn đọc</summary><p className="jp whitespace-pre-wrap"><QuestionText text={question.passageText} /></p></details>}
        {flashcardMode ? <>
          <h2 id="pomodoro-question-title" className="jp question-text">{unit.flashcard.front}</h2>
          {revealed && <div className="answer-feedback feedback-correct"><strong className="jp">{unit.flashcard.back}</strong>{unit.flashcard.extra && <p>{unit.flashcard.extra}</p>}</div>}
          {!revealed ? <button type="button" className="btn btn-secondary" disabled={resting} onClick={() => setRevealed(true)}>Lật xem đáp án</button> : !feedback && <div className="flex flex-wrap gap-3"><button type="button" className="btn btn-secondary" disabled={resting} onClick={() => answer(false)}>Chưa nhớ</button><button type="button" className="btn btn-primary" disabled={resting} onClick={() => answer(true)}>Đã nhớ</button></div>}
        </> : question && <>
          <h2 id="pomodoro-question-title" className="jp question-text"><QuestionText text={question.questionText} /></h2>
          <div className="answer-list">{Object.entries(question.options).map(([letter, text]) => {
            const selected = picked === letter || pendingChoice === letter
            const isCorrect = letter === question.correctAnswer
            const state = feedback && isCorrect ? 'is-correct' : feedback && selected && !isCorrect ? 'is-wrong' : selected ? 'is-selected' : ''
            return <button key={letter} type="button" className={`answer-option ${state}`} aria-pressed={selected} disabled={Boolean(feedback) || resting} onClick={() => confirm(letter)}><span className="answer-letter">{letter}</span><span className="jp flex-1">{text}</span></button>
          })}</div>
          {!feedback && <p className="keyboard-hint" aria-live="polite">{pendingChoice ? `Đang chọn ${pendingChoice} · Nhấn Space để trả lời` : '1 / 2 / 3 / 4 chọn A / B / C / D · Space xác nhận'}</p>}
          {feedback && <div className={`answer-feedback ${feedback.correct ? 'feedback-correct' : 'feedback-wrong'}`} role="status"><strong>{feedback.message}</strong>{question.explanation && <p>{question.explanation}</p>}{question.keyTakeaway && <p>{question.keyTakeaway}</p>}{question.translation && <p><strong>Nghĩa:</strong> {question.translation}</p>}</div>}
        </>}
        {feedback && flashcardMode && <div className={`answer-feedback ${feedback.correct ? 'feedback-correct' : 'feedback-wrong'}`} role="status"><strong>{feedback.message}</strong></div>}
        {feedback && <button type="button" className="btn btn-primary mt-4" disabled={resting} onClick={continueLearning}>Câu tiếp theo</button>}
      </section>
    </>}
  </div>
}
