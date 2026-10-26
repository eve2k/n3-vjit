import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react'
import { quizSections } from '../data/index.js'
import SpeakButton from './SpeakButton.jsx'
import { addWrongQuestion, getWrongQuestions, markQuestionCompleted, markWrongQuestionCorrect, saveLastLesson } from '../utils/storage.js'
import { getMistakeQuestions, gradeExam } from '../utils/learning.js'

function shuffle(list) {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function makeQuestions(mode, sectionId, shuffled = false) {
  const pool = mode === 'mistakes' ? getMistakeQuestions(getWrongQuestions()) : quizSections.find((section) => section.id === sectionId)?.questions || []
  return shuffled ? shuffle(pool) : pool
}

export default function QuizEngine({ mistakeMode = false }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialSection = quizSections.some((section) => section.id === searchParams.get('section')) ? searchParams.get('section') : quizSections[0].id
  const initialMode = mistakeMode || searchParams.get('mode') === 'mistakes' ? 'mistakes' : 'study'
  const [sectionId, setSectionId] = useState(initialSection)
  const [mode, setMode] = useState(initialMode)
  const [shuffleOn, setShuffleOn] = useState(false)
  const [questions, setQuestions] = useState(() => makeQuestions(initialMode, initialSection))
  const [index, setIndex] = useState(() => initialMode === 'study' ? Math.max(0, makeQuestions('study', initialSection).findIndex((question) => question.id === searchParams.get('question'))) : 0)
  const [answers, setAnswers] = useState({})
  const q = questions[index]
  const currentQuestionId = q?.id
  const score = gradeExam(questions, answers)
  const currentPick = q ? answers[q.id] : null
  const isCorrect = q && String(currentPick) === String(q.correctAnswer)

  useEffect(() => {
    if (mode === 'study' && currentQuestionId) saveLastLesson(sectionId, currentQuestionId)
  }, [mode, sectionId, currentQuestionId])

  const resetSession = (nextMode = mode, nextSection = sectionId, nextShuffle = shuffleOn) => {
    if (nextMode === 'exam') { navigate('/exam'); return }
    setMode(nextMode)
    setSectionId(nextSection)
    setShuffleOn(nextShuffle)
    setQuestions(makeQuestions(nextMode, nextSection, nextShuffle))
    setIndex(0)
    setAnswers({})
  }

  const select = (letter) => {
    if (!q || answers[q.id]) return
    setAnswers((previous) => ({ ...previous, [q.id]: letter }))
    markQuestionCompleted(q.section, q.id)
    if (String(letter) === String(q.correctAnswer)) markWrongQuestionCorrect(q.section, q.id)
    else addWrongQuestion(q.section, q.id)
  }

  return (
    <div className="page-shell quiz-page">
      <div className="page-heading">
        <div><p className="eyebrow">{mode === 'mistakes' ? 'BIẾN CÂU SAI THÀNH KIẾN THỨC' : 'MỖI CÂU HỎI, MỘT BƯỚC TIẾN'}</p><h1>{mode === 'mistakes' ? 'Sổ tay câu sai' : 'Luyện câu hỏi'}</h1><p className="page-description">{mode === 'mistakes' ? 'Trả lời đúng trong 2 lượt ôn để đưa một câu ra khỏi sổ tay.' : 'Chọn đáp án, đọc lời giải và ghi nhớ kiến thức quan trọng.'}</p></div>
        <Link to="/" className="text-link"><ArrowLeft size={15} aria-hidden="true" />Tổng quan</Link>
      </div>

      <div className="panel quiz-toolbar">
        {!mistakeMode && <>
          <label><span>Chế độ học</span><select value={mode} onChange={(event) => resetSession(event.target.value)}><option value="study">Luyện tập</option><option value="exam">Thi thử tổng hợp</option><option value="mistakes">Ôn câu sai</option></select></label>
          <label className="quiz-section-select"><span>Chuyên đề</span><select value={sectionId} disabled={mode !== 'study'} onChange={(event) => resetSession(mode, event.target.value)}>{quizSections.map((section) => <option key={section.id} value={section.id}>{section.title} ({section.questions.length})</option>)}</select></label>
        </>}
        <label className="shuffle-control"><input type="checkbox" checked={shuffleOn} onChange={(event) => resetSession(mode, sectionId, event.target.checked)} /><span>Đảo câu hỏi</span></label>
      </div>

      {!q ? <section className="panel empty-state"><CheckCircle2 size={38} aria-hidden="true" /><h2 className="text-lg font-semibold text-[var(--text)]">{mode === 'mistakes' ? 'Sổ tay câu sai đang trống' : 'Chưa có câu hỏi'}</h2><p>{mode === 'mistakes' ? 'Các câu trả lời sai sẽ tự xuất hiện ở đây để bạn ôn lại.' : 'Hãy chọn một chuyên đề khác để tiếp tục học.'}</p><Link to="/quiz" className="btn btn-primary">Vào luyện câu hỏi<ArrowRight size={16} aria-hidden="true" /></Link></section> : <>
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
                  const chosen = currentPick === letter
                  const correctOption = String(letter) === String(q.correctAnswer)
                  let state = chosen ? 'is-selected' : ''
                  if (currentPick) {
                    if (correctOption) state = 'is-correct'
                    else if (chosen) state = 'is-wrong'
                  }
                  return <button key={letter} type="button" aria-pressed={chosen} disabled={Boolean(currentPick)} onClick={() => select(letter)} className={`answer-option ${state}`}><span className="answer-letter">{letter}</span><span className="jp flex-1">{text}</span>{state === 'is-correct' && <CheckCircle2 size={19} aria-label="Đáp án đúng" />}</button>
                })}
              </div>
              {currentPick && <div className={`answer-feedback ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}`} role="status"><strong>{isCorrect ? 'Chính xác!' : `Chưa đúng. Đáp án là ${q.correctAnswer}.`}</strong>{q.keyTakeaway && <p className="font-semibold">{q.keyTakeaway}</p>}{q.explanation && <p>{q.explanation}</p>}</div>}
            </section>
            <div className="quiz-navigation"><button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}><ArrowLeft size={16} aria-hidden="true" />Câu trước</button><span>{index + 1} / {questions.length}</span><button type="button" className="btn btn-primary" disabled={index === questions.length - 1} onClick={() => setIndex((value) => value + 1)}>Câu tiếp<ArrowRight size={16} aria-hidden="true" /></button></div>
            {score.answered === questions.length && <section className="notice notice-success mt-5"><strong>Đã hoàn thành lượt ôn: {score.correct}/{score.total} câu đúng.</strong><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn btn-secondary" onClick={() => resetSession()}>Ôn một lượt mới</button><Link to="/" className="btn btn-secondary">Về tổng quan</Link></div></section>}
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
            <p className="question-map-note">Chọn số để chuyển nhanh đến câu hỏi.</p>
            <button type="button" className="btn btn-secondary w-full mt-4" onClick={() => resetSession()}><RotateCcw size={16} aria-hidden="true" />Ôn lượt mới</button>
          </aside>
        </div>
      </>}
    </div>
  )
}
