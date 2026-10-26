import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, RotateCcw } from 'lucide-react'
import { allQuizQuestions, quizSections } from '../data/index.js'
import SpeakButton from './SpeakButton.jsx'
import { addWrongQuestion, getCompletedQuestions, getSpacedRepetition, getStudyRoadmap, getWrongQuestions, markQuestionCompleted, markWrongQuestionCorrect, recordSpacedAnswer, saveLastLesson } from '../utils/storage.js'
import { getMistakeQuestions, gradeExam } from '../utils/learning.js'
import { buildStudyPlan, formatReviewDate, SRS_SESSION_LIMIT, srsKey } from '../utils/spacedRepetition.js'
import { effectiveReviewDue } from '../utils/studyRoadmap.js'
import StudyRoadmap from './StudyRoadmap.jsx'
import { useAuth } from '../context/authContext.js'
import useQuestionShortcuts from '../hooks/useQuestionShortcuts.js'

const quizKeys = new Set(allQuizQuestions.map(srsKey))
function prepareSession(mode, sectionId, now) {
  const records = getSpacedRepetition()
  const studyPlan = getStudyRoadmap()
  if (mode === 'study') return buildStudyPlan(allQuizQuestions, records, getCompletedQuestions(), { now, sectionId, studyPlan })
  const mistakes = getMistakeQuestions(getWrongQuestions())
  const dueTime = question => records[srsKey(question)] ? effectiveReviewDue(records[srsKey(question)], studyPlan, srsKey(question)) : 0
  const due = mistakes.filter(question => !quizKeys.has(srsKey(question)) || !records[srsKey(question)] || dueTime(question) <= now).sort((a, b) => dueTime(a) - dueTime(b))
  const future = mistakes.filter(question => records[srsKey(question)]).map(dueTime).filter(time => time > now)
  return { questions: due.slice(0, SRS_SESSION_LIMIT), reviewCount: Math.min(due.length, SRS_SESSION_LIMIT), newCount: 0, dueCount: due.length, unseenCount: 0, newToday: 0, newAllowance: 0, dailyLimit: 0, nextDueAt: future.length ? new Date(Math.min(...future)).toISOString() : null }
}

export default function QuizEngine({ mistakeMode = false }) {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialSection = quizSections.some(section => section.id === searchParams.get('section')) ? searchParams.get('section') : 'all'
  const [sectionId, setSectionId] = useState(initialSection)
  const [mode, setMode] = useState(mistakeMode || searchParams.get('mode') === 'mistakes' ? 'mistakes' : 'study')
  const [now, setNow] = useState(Date.now)
  const [started, setStarted] = useState(false)
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [outcomes, setOutcomes] = useState({})
  const [notice, setNotice] = useState(null)
  const answered = useRef({})
  const [sessionId, setSessionId] = useState('')
  const plan = prepareSession(mode, sectionId, now)
  const q = started ? questions[index] : null
  const score = gradeExam(questions, answers)
  const currentPick = q ? answers[q.id] : null
  const isCorrect = q && String(currentPick) === String(q.correctAnswer)
  const currentQuestionId = q?.id
  const currentSectionId = q?.section

  useEffect(() => {
    if (started) return undefined
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [started])
  useEffect(() => {
    if (currentQuestionId) saveLastLesson(currentSectionId, currentQuestionId)
  }, [currentSectionId, currentQuestionId])

  const resetSession = (nextMode = mode, nextSection = sectionId, timestamp = now) => {
    clearPending()
    if (nextMode === 'exam') { navigate('/exam'); return }
    setMode(nextMode); setSectionId(nextSection); setStarted(false)
    setNow(timestamp); setQuestions([]); setAnswers({}); setOutcomes({}); setNotice(null); setIndex(0)
    answered.current = {}
  }
  const startSession = (timestamp) => {
    const next = prepareSession(mode, sectionId, timestamp)
    setNow(timestamp)
    if (!next.questions.length) return
    setSessionId(crypto.randomUUID())
    answered.current = {}
    setQuestions(next.questions); setAnswers({}); setOutcomes({}); setIndex(0); setNotice(null); setStarted(true)
    clearPending()
  }
  const select = letter => {
    if (!q || Object.hasOwn(answered.current, q.id) || !Object.hasOwn(q.options, letter)) return
    try {
      const correct = String(letter) === String(q.correctAnswer)
      const record = quizKeys.has(srsKey(q)) ? recordSpacedAnswer(q, correct, { now: Date.now(), reviewId: `${sessionId}/${q.id}` }) : null
      answered.current[q.id] = letter
      setAnswers(previous => ({ ...previous, [q.id]: letter }))
      if (record) setOutcomes(previous => ({ ...previous, [q.id]: record }))
      markQuestionCompleted(q.section, q.id)
      if (correct && (!record || record.lastReviewId === `${sessionId}/${q.id}`)) markWrongQuestionCorrect(q.section, q.id)
      else if (!correct) addWrongQuestion(q.section, q.id)
      setNotice(null)
    } catch (error) { setNotice(error.message) }
  }
  const { pendingChoice, confirm, clearPending } = useQuestionShortcuts({
    question: q, answer: currentPick, locked: Boolean(currentPick), disabled: !started, scope: sessionId,
    onAnswer: select, onNext: () => setIndex(value => Math.min(questions.length - 1, value + 1)),
  })

  return <div className="page-shell quiz-page">
    <div className="page-heading"><div><p className="eyebrow">{mode === 'mistakes' ? 'BIẾN CÂU SAI THÀNH KIẾN THỨC' : 'HỌC ÍT MỖI LẦN, ÔN ĐÚNG LỊCH'}</p><h1>{mode === 'mistakes' ? 'Sổ tay câu sai' : 'Ôn tập giãn cách'}</h1><p className="page-description">{mode === 'mistakes' ? 'Mỗi phiên tối đa 20 câu. Câu trắc nghiệm đã có lịch chỉ xuất hiện khi đến hạn; trả lời đúng trong 2 lượt ôn để bỏ khỏi sổ tay.' : 'Ưu tiên câu đến hạn, thêm ít câu mới và tăng dần khoảng cách khi bạn nhớ đúng.'}</p></div><Link to="/" className="text-link"><ArrowLeft size={15} aria-hidden="true" />Tổng quan</Link></div>
    <div className="panel quiz-toolbar">
      {!mistakeMode && <><label><span>Chế độ học</span><select value={mode} onChange={event => resetSession(event.target.value, sectionId, Date.now())}><option value="study">Ôn tập giãn cách</option><option value="mistakes">Ôn câu sai đến hạn</option><option value="exam">Thi thử tổng hợp</option></select></label><label className="quiz-section-select"><span>Chuyên đề</span><select value={sectionId} disabled={mode !== 'study'} onChange={event => resetSession(mode, event.target.value, Date.now())}><option value="all">Tất cả chuyên đề · chia nhỏ theo phiên</option>{quizSections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label></>}
      <span className="text-sm text-[var(--muted)]">Tối đa {SRS_SESSION_LIMIT} câu / phiên</span>
    </div>
    {notice && <p className="notice notice-error mb-5" role="alert">{notice}</p>}
    {!started && mode === 'study' && <StudyRoadmap stats={plan} now={now} onChange={() => setNow(Date.now())} />}
    {!started ? <section className="panel srs-plan">
      <span className="feature-icon"><CalendarClock size={25} aria-hidden="true" /></span>
      <h2>{plan.roadmap?.todayEvent ? 'Dành thời gian cho thi thử và chữa đề' : plan.questions.length ? 'Phiên học vừa sức cho hôm nay' : 'Bạn có thể nghỉ ở đây'}</h2>
      <p>{user ? 'Lịch riêng của bạn được lưu theo tài khoản và tự đồng bộ.' : 'Bạn đang học thử một phiên ngắn. Không lưu tiến độ hoặc lịch ôn cho khách.'}</p>
      <div className="srs-metrics"><div><strong>{plan.dueCount}</strong><span>Câu đến hạn</span></div><div><strong>{plan.reviewCount}</strong><span>Câu ôn trong phiên</span></div><div><strong>{plan.newCount}</strong><span>Câu mới trong phiên</span></div><div><strong>{user ? plan.newToday : '—'}</strong><span>{user ? `/ ${plan.dailyLimit} câu mới hôm nay` : 'Đăng nhập để có lịch riêng'}</span></div></div>
      {plan.questions.length ? <p>Phiên này có <strong>{plan.questions.length} câu</strong>: {plan.reviewCount} câu ôn và {plan.newCount} câu mới. Câu đến hạn được ưu tiên trước.</p> : <p>{mode === 'mistakes' ? 'Không có câu sai đến hạn trong lượt này.' : plan.roadmap?.todayEvent ? 'Hôm nay ưu tiên thi thử hoặc chữa đề, không giao câu mới.' : plan.roadmap?.insufficientStudyTime ? 'Xem lịch thi thử và phần thời gian còn lại trong lộ trình phía trên.' : plan.unseenCount && !plan.newAllowance ? 'Đã hết phần câu mới được chia hôm nay. Quay lại ngày học tiếp theo hoặc khi có câu đến hạn.' : 'Chưa có câu đến hạn trong chuyên đề đã chọn.'}</p>}
      {plan.dueCount > plan.reviewCount && <p>{plan.roadmap?.todayEvent ? `Còn ${plan.dueCount - plan.reviewCount} câu chờ ôn. Hôm nay ưu tiên thời gian làm đề hoặc chữa đề.` : `Còn ${plan.dueCount - plan.reviewCount} câu đến hạn cho các phiên ngắn tiếp theo.`}</p>}
      {plan.nextDueAt && <p>Lần ôn sắp tới: <strong>{formatReviewDate(plan.nextDueAt)}</strong> (giờ Việt Nam).</p>}
      <div className="flex flex-wrap gap-3 mt-5"><button type="button" className="btn btn-primary" disabled={!plan.questions.length} onClick={() => startSession(Date.now())}>Bắt đầu {plan.questions.length} câu<ArrowRight size={16} aria-hidden="true" /></button><Link to="/" className="btn btn-secondary">Về tổng quan</Link></div>
      <details className="srs-explanation"><summary>Lịch ôn thay đổi thế nào?</summary><p>Đúng khi đến hạn: ôn sau 1 → 3 → 7 → 14 → 30 → 60 ngày. Sai: trở về bước học lại và hẹn sau 10 phút. Trả lời đúng trước hạn không tăng bậc. Số câu mới mỗi ngày tự chia theo ngày bắt đầu và ngày thi; ngày học tính theo giờ Việt Nam. Các câu cũ được hẹn ôn trong giai đoạn củng cố và trước ngày thi.</p><p>Câu từng làm ở phiên bản cũ được đưa vào ôn lại, chưa được coi là đã nhớ lâu. Phần này áp dụng cho ngân hàng luyện câu hỏi; thi thử và flashcard giữ cách hoạt động riêng.</p></details>
    </section> : <>
        <div className="quiz-layout">
          <div>
            <section className="panel question-card" aria-labelledby="question-heading">
              <div className="question-meta"><span>{q.contextTitle || quizSections.find((section) => section.id === q.section)?.label || q.section} · Câu {index + 1}/{questions.length}</span><SpeakButton text={q.questionText} /></div>
              <div className="progress-track mb-6"><span style={{ width: `${(index + 1) / questions.length * 100}%` }} /></div>
              {q.passageText && <details className="question-context" open><summary>Đoạn văn của câu hỏi</summary><p className="jp whitespace-pre-wrap">{q.passageText}</p></details>}
              {q.image && <img src={q.image} alt="Hình minh họa của câu hỏi" className="mb-4 max-h-64 rounded-lg object-contain" />}
              <h2 id="question-heading" className="jp question-text">{q.questionText}</h2>
              <div className="answer-list">
                {Object.entries(q.options).map(([letter, text]) => {
                  const chosen = (pendingChoice || currentPick) === letter
                  const correctOption = String(letter) === String(q.correctAnswer)
                  let state = chosen ? 'is-selected' : ''
                  if (currentPick) {
                    if (correctOption) state = 'is-correct'
                    else if (chosen) state = 'is-wrong'
                  }
                  return <button key={letter} type="button" aria-pressed={chosen} disabled={Boolean(currentPick)} onClick={() => confirm(letter)} className={`answer-option ${state}`}><span className="answer-letter">{letter}</span><span className="jp flex-1">{text}</span>{state === 'is-correct' && <CheckCircle2 size={19} aria-label="Đáp án đúng" />}</button>
                })}
              </div>
              <p className="keyboard-hint" aria-live="polite">{pendingChoice ? `Đang chọn ${pendingChoice} · Nhấn Space để trả lời` : currentPick ? 'Space để sang câu tiếp' : '1 / 2 / 3 / 4 chọn A / B / C / D · Space để trả lời'}</p>
              {currentPick && <div className={`answer-feedback ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}`} role="status"><strong>{isCorrect ? 'Chính xác!' : `Chưa đúng. Đáp án là ${q.correctAnswer}.`}</strong>{q.keyTakeaway && <p className="font-semibold">{q.keyTakeaway}</p>}{q.explanation && <p>{q.explanation}</p>}{outcomes[q.id] && <p className="review-schedule">{outcomes[q.id].lastReviewId === `${sessionId}/${q.id}` ? 'Lần ôn tiếp theo: ' : 'Lịch ôn giữ nguyên: '}{formatReviewDate(outcomes[q.id].dueAt)} (giờ Việt Nam)</p>}</div>}
            </section>
            <div className="quiz-navigation"><button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}><ArrowLeft size={16} aria-hidden="true" />Câu trước</button><span>{index + 1} / {questions.length}</span><button type="button" className="btn btn-primary" disabled={index === questions.length - 1} onClick={() => setIndex((value) => value + 1)}>Câu tiếp<ArrowRight size={16} aria-hidden="true" /></button></div>
            {score.answered === questions.length && <section className="notice notice-success mt-5"><strong>Đã hoàn thành phiên học: {score.correct}/{score.total} câu đúng.</strong><p>{user ? 'Đã cập nhật lịch từng câu. Bạn có thể nghỉ và quay lại khi đến hạn.' : 'Kết quả học thử không được lưu.'}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn btn-secondary" onClick={() => resetSession(mode, sectionId, Date.now())}>Xem lịch ôn tiếp</button><Link to="/" className="btn btn-secondary">Về tổng quan</Link></div></section>}
          </div>

          <aside className="panel question-map" aria-label="Danh sách câu hỏi">
            <h2>Tiến độ lượt học</h2><p><strong>{score.answered}</strong>/{questions.length} câu đã trả lời</p>
            <div className="progress-track"><span style={{ width: `${score.answered / questions.length * 100}%` }} /></div>
            <div className="question-grid">{questions.map((question, number) => {
              const choice = answers[question.id]
              let state = choice ? 'is-answered' : ''
              if (choice) state = String(choice) === String(question.correctAnswer) ? 'is-correct' : 'is-wrong'
              return <button key={question.id} type="button" aria-label={`Câu ${number + 1}${choice ? ', đã trả lời' : ', chưa trả lời'}`} aria-current={index === number ? 'step' : undefined} onClick={() => setIndex(number)} className={`${state} ${index === number ? 'is-current' : ''}`}>{number + 1}</button>
            })}</div>
            <p className="question-map-note">Chọn số để xem lại câu trong phiên này. Câu sai sẽ được hẹn ôn sớm hơn.</p>
            <button type="button" className="btn btn-secondary w-full mt-4" onClick={() => resetSession(mode, sectionId, Date.now())}><RotateCcw size={16} aria-hidden="true" />Chọn phiên khác</button>
          </aside>
        </div>
    </>}
  </div>
}
