import { questionInstruction } from '../utils/questionMarkup.js'
import QuestionText from './QuestionText.jsx'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, RotateCcw } from 'lucide-react'
import { allQuizQuestions, quizSections } from '../data/index.js'
import { grammarGuide } from '../data/grammarGuide.js'
import SpeakButton from './SpeakButton.jsx'
import { addWrongQuestion, getCompletedQuestions, getWrongQuestions, markQuestionCompleted, markWrongQuestionCorrect, recordSpacedAnswer, saveLastLesson } from '../utils/storage.js'
import { getMistakeQuestions, getSectionProgress, gradeExam } from '../utils/learning.js'
import { useAuth } from '../context/authContext.js'
import useQuestionShortcuts from '../hooks/useQuestionShortcuts.js'
import { createId } from '../utils/id.js'
import { usableQuestion } from '../utils/questionUsability.js'

function sectionQuestions(sectionId, mistakeMode) {
  const questions = mistakeMode ? getMistakeQuestions(getWrongQuestions()) : allQuizQuestions
  return (sectionId === 'all' || mistakeMode ? questions : questions.filter(question => question.section === sectionId)).filter(usableQuestion)
}

export default function QuizEngine({ mistakeMode = false, focusMode = false }) {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const initialSection = quizSections.some(section => section.id === searchParams.get('section')) ? searchParams.get('section') : 'all'
  const [sectionId, setSectionId] = useState(initialSection)
  const [started, setStarted] = useState(false)
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [notice, setNotice] = useState('')
  const answered = useRef({})
  const [sessionId, setSessionId] = useState('')
  const q = started ? questions[index] : null
  const score = gradeExam(questions, answers)
  const currentPick = q ? answers[q.id] : null
  const isCorrect = q && String(currentPick) === String(q.correctAnswer)
  const currentSection = quizSections.find(section => section.id === sectionId)
  const selectedQuestions = sectionQuestions(sectionId, mistakeMode)
  const relatedGrammar = q?.section === 'renshuu4'
    ? grammarGuide.filter(item => item.group === 'grammar' && item.refs?.includes(q.questionNumber))
    : q?.section === 'renshuu5'
      ? grammarGuide.filter(item => item.group === 'forms' && (item.refs?.includes(q.questionNumber) || item.formRefs?.includes(q.questionNumber)))
      : []

  useEffect(() => {
    if (q) saveLastLesson(q.section, q.id)
  }, [q])

  const clearSession = (nextSection = sectionId) => {
    clearPending()
    setSectionId(nextSection)
    setStarted(false)
    setQuestions([])
    setAnswers({})
    setNotice('')
    setIndex(0)
    answered.current = {}
  }

  const startSession = (nextSection = sectionId) => {
    const nextQuestions = sectionQuestions(nextSection, mistakeMode)
    if (!nextQuestions.length) return
    setSectionId(nextSection)
    setSessionId(createId())
    answered.current = {}
    setQuestions(nextQuestions)
    setAnswers({})
    setIndex(0)
    setNotice('')
    setStarted(true)
    clearPending()
  }

  const select = letter => {
    if (!q || answered.current[q.id] || !Object.hasOwn(q.options, letter)) return
    try {
      const correct = String(letter) === String(q.correctAnswer)
      recordSpacedAnswer(q, correct, { now: Date.now(), reviewId: createId() })
      answered.current[q.id] = letter
      setAnswers(previous => ({ ...previous, [q.id]: letter }))
      markQuestionCompleted(q.section, q.id)
      if (correct) markWrongQuestionCorrect(q.section, q.id)
      else addWrongQuestion(q.section, q.id)
      setNotice('')
    } catch (error) { setNotice(error.message) }
  }

  const { pendingChoice, confirm, clearPending } = useQuestionShortcuts({
    question: q, answer: currentPick, locked: Boolean(currentPick), disabled: !started, scope: sessionId,
    onAnswer: select, onNext: () => setIndex(value => Math.min(questions.length - 1, value + 1)),
  })

  const title = mistakeMode ? 'Câu cần ôn lại' : focusMode ? 'Học từng phần' : 'Ngân hàng câu hỏi'
  const description = mistakeMode ? 'Làm lại câu bạn từng trả lời sai.' : focusMode ? 'Chọn một phần, học lần lượt và xem đáp án ngay sau mỗi câu.' : 'Chọn chuyên đề rồi luyện các câu hỏi theo thứ tự.'

  return <div className={`page-shell quiz-page ${focusMode ? 'focus-study-page study-space-page' : ''}`}>
    <FuriganaToggle disabled={q?.section === 'renshuu3' || sectionId === 'renshuu3'} />
    <div className="page-heading"><div><p className="eyebrow">{focusMode ? 'KHÔNG GIAN HỌC TẬP' : mistakeMode ? 'CỦNG CỐ KIẾN THỨC' : 'LUYỆN TẬP'}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{!focusMode && <Link to="/" className="text-link"><ArrowLeft size={15} aria-hidden="true" />Tổng quan</Link>}</div>

    {notice && <p className="notice notice-error" role="alert">{notice}</p>}
    {!started && focusMode && <section className="study-space-catalog" aria-label="Chọn phần học">
      {quizSections.map((section, sectionIndex) => {
        const usable = section.questions.filter(usableQuestion)
        const completed = getSectionProgress({ ...section, questions: usable }, getCompletedQuestions())
        const total = usable.length
        return <button key={section.id} type="button" className="study-part-card" onClick={() => startSession(section.id)}>
          <span className="study-part-index">{String(sectionIndex + 1).padStart(2, '0')}</span>
          <span className="study-part-copy"><span className="eyebrow jp">{section.label}</span><strong>{section.title.replace(/^.*? · /, '')}</strong><small>{completed}/{total} câu đã làm</small><span className="progress-track"><span style={{ width: `${completed / total * 100}%` }} /></span></span>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      })}
      <p className="study-space-note">Chọn một phần để bắt đầu. Câu trả lời và câu sai sẽ được lưu khi bạn đăng nhập.</p>
    </section>}

    {!started && !focusMode && <>
      {!mistakeMode && <div className="panel quiz-toolbar"><label className="quiz-section-select"><span>Chọn chuyên đề</span><select value={sectionId} onChange={event => setSectionId(event.target.value)}><option value="all">Tất cả chuyên đề</option>{quizSections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label><span className="text-sm text-[var(--muted)]">{selectedQuestions.length} câu</span></div>}
      <section className="panel study-start-card"><span className="feature-icon"><BookOpen size={23} aria-hidden="true" /></span><h2>{mistakeMode ? `${selectedQuestions.length} câu đang chờ bạn ôn` : currentSection?.title || 'Toàn bộ ngân hàng câu hỏi'}</h2><p>{user ? 'Tiến độ câu hỏi sẽ tự lưu và đồng bộ với tài khoản.' : 'Bạn đang học thử. Câu trả lời sẽ không được lưu sau khi rời trang.'}</p><p>{selectedQuestions.length} câu · Chọn đáp án để xem ngay phần giải thích.</p><div className="flex flex-wrap gap-3 mt-5"><button type="button" className="btn btn-primary" disabled={!selectedQuestions.length} onClick={() => startSession()}>{mistakeMode ? 'Bắt đầu ôn câu sai' : 'Bắt đầu học'}<ArrowRight size={16} aria-hidden="true" /></button><Link to="/study" className="btn btn-secondary">Không gian học tập</Link></div></section>
    </>}

    {started && q && <div className="quiz-layout focus-quiz-layout">
      <div>
        <section className="panel question-card" aria-labelledby="question-heading">
          <div className="question-meta"><span>{q.contextTitle || quizSections.find(section => section.id === q.section)?.label || q.section} · Câu {index + 1}/{questions.length}</span><SpeakButton text={q.questionText} /></div>
          <div className="progress-track mb-6"><span style={{ width: `${(index + 1) / questions.length * 100}%` }} /></div>
          {q.passageText && <details className="question-context" open><summary>Đoạn văn của câu hỏi</summary><p className="jp whitespace-pre-wrap"><QuestionText text={q.passageText} /></p></details>}
          {q.image && <img src={q.image} alt="Hình minh họa của câu hỏi" className="mb-4 max-h-64 rounded-lg object-contain" />}
          <p className="question-instruction">{questionInstruction(q)}</p><h2 id="question-heading" className="jp question-text"><QuestionText text={q.questionText} /></h2>
          <div className="answer-list">{Object.entries(q.options || {}).map(([letter, text]) => {
            const chosen = (pendingChoice || currentPick) === letter
            const correctOption = String(letter) === String(q.correctAnswer)
            let state = chosen ? 'is-selected' : ''
            if (currentPick) {
              if (q.correctAnswer && correctOption) state = 'is-correct'
              else if (chosen && q.correctAnswer) state = 'is-wrong'
            }
            return <button key={letter} type="button" aria-pressed={chosen} disabled={Boolean(currentPick)} onClick={() => confirm(letter)} className={`answer-option ${state}`}><span className="answer-letter">{letter}</span><span className="jp flex-1">{text}</span>{state === 'is-correct' && <CheckCircle2 size={19} aria-label="Đáp án đúng" />}</button>
          })}</div>
          <p className="keyboard-hint" aria-live="polite">{pendingChoice ? `Đang chọn ${pendingChoice} · Nhấn Space để trả lời` : currentPick ? 'Space để sang câu tiếp' : '1 / 2 / 3 / 4 chọn A / B / C / D · Space để trả lời'}</p>
          {currentPick && <div className={`answer-feedback ${q.correctAnswer ? isCorrect ? 'feedback-correct' : 'feedback-wrong' : ''}`} role="status"><strong>{q.correctAnswer ? isCorrect ? 'Chính xác!' : `Đáp án đúng: ${q.correctAnswer}.` : 'Đã ghi nhận câu trả lời.'}</strong>{q.keyTakeaway && <p className="font-semibold">{q.keyTakeaway}</p>}{q.translation && <p><strong>Nghĩa:</strong> {q.translation}</p>}{q.explanation && <p><strong>Giải thích:</strong> {q.explanation}</p>}{relatedGrammar.length > 0 && <p className="related-grammar"><strong>Mẫu ngữ pháp liên quan:</strong> {relatedGrammar.map((item, itemIndex) => <span key={item.id}>{itemIndex > 0 ? ' · ' : ''}<Link to={`/grammar?focus=${encodeURIComponent(item.id)}`}>{item.title}</Link></span>)}</p>}</div>}
        </section>
        <div className="quiz-navigation"><button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => setIndex(value => value - 1)}><ArrowLeft size={16} aria-hidden="true" />Câu trước</button><span>{index + 1} / {questions.length}</span><button type="button" className="btn btn-primary" disabled={index === questions.length - 1} onClick={() => setIndex(value => value + 1)}>Câu tiếp<ArrowRight size={16} aria-hidden="true" /></button></div>
        {score.answered === questions.length && <section className="notice notice-success mt-5"><strong>Đã hoàn thành phần học: {score.correct}/{score.total} câu đúng.</strong><p>{user ? 'Tiến độ đã được lưu vào tài khoản.' : 'Bạn có thể đăng nhập để lưu tiến độ học.'}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn btn-secondary" onClick={() => clearSession()}><RotateCcw size={16} aria-hidden="true" />Chọn phần khác</button><Link to="/" className="btn btn-secondary">Về tổng quan</Link></div></section>}
      </div>
      <aside className="panel question-map" aria-label="Danh sách câu hỏi"><h2>Tiến độ phần học</h2><p><strong>{score.answered}</strong>/{questions.length} câu đã trả lời</p><div className="progress-track"><span style={{ width: `${score.answered / questions.length * 100}%` }} /></div><div className="question-grid">{questions.map((question, number) => { const choice = answers[question.id]; let state = choice ? 'is-answered' : ''; if (choice && question.correctAnswer) state = String(choice) === String(question.correctAnswer) ? 'is-correct' : 'is-wrong'; return <button key={question.id} type="button" aria-label={`Câu ${number + 1}${choice ? ', đã trả lời' : ', chưa trả lời'}`} aria-current={index === number ? 'step' : undefined} onClick={() => setIndex(number)} className={`${state} ${index === number ? 'is-current' : ''}`}>{number + 1}</button> })}</div><button type="button" className="btn btn-secondary w-full mt-4" onClick={() => clearSession()}><RotateCcw size={16} aria-hidden="true" />Chọn phần khác</button></aside>
    </div>}
  </div>
}
import FuriganaToggle from './FuriganaToggle.jsx'
