import QuestionText from './QuestionText.jsx'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock3, Headphones, PenLine, RotateCcw, Save, Send, Trophy } from 'lucide-react'
import { getQuizHistory } from '../utils/storage.js'
import { formatDuration, gradeExam } from '../utils/learning.js'
import { createMockExam, EXAM_MAX_SCORE, EXAM_PASS_SCORE, gradeMockExam, MOCK_EXAM_PARTS, parseManualScore, restoreMockExam, saveMockExamAttempt } from '../utils/mockExam.js'
import useQuestionShortcuts from '../hooks/useQuestionShortcuts.js'
import { useAuth } from '../context/authContext.js'

const STATUS_LABELS = { passed: 'Đạt', failed: 'Không đạt', pending: 'Chờ chấm', excluded: 'Không tính điểm' }
const PART_ICONS = { reading: BookOpen, passages: BookOpen, listening: Headphones, writing: PenLine }
const displayScore = (score) => score === null ? 'Chưa chấm' : score.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function MockExam() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [initial] = useState(() => {
    const history = getQuizHistory()
    const saved = searchParams.get('review') === 'latest' ? [...history].reverse().find(attempt => attempt.mode === 'mock-exam') : history.find(attempt => attempt.mode === 'mock-exam' && attempt.id === searchParams.get('attempt'))
    const restored = saved && restoreMockExam(saved.exam)
    return restored ? { exam: restored, saved } : { exam: createMockExam(), saved: null }
  })
  const [exam, setExam] = useState(initial.exam)
  const [phase, setPhase] = useState(initial.saved ? 'results' : 'setup')
  const [activePart, setActivePart] = useState('reading')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [passageIndex, setPassageIndex] = useState(0)
  const [passageQuestionIndex, setPassageQuestionIndex] = useState(0)
  const [listeningIndex, setListeningIndex] = useState(0)
  const [answers, setAnswers] = useState(initial.saved?.answers || {})
  const [writingText, setWritingText] = useState(initial.saved?.writingText || '')
  const [manualScores, setManualScores] = useState(initial.saved?.manualScores || {})
  const [scoreInputs, setScoreInputs] = useState(initial.saved?.manualScores || {})
  const [startedAt, setStartedAt] = useState(Date.now)
  const [elapsed, setElapsed] = useState(initial.saved?.elapsed || 0)
  const [notice, setNotice] = useState((searchParams.has('attempt') || searchParams.get('review') === 'latest') && !initial.saved ? { text: 'Không tìm thấy đề đã lưu hoặc ngân hàng câu hỏi đã thay đổi. Bạn có thể bắt đầu một đề mới.', error: true } : null)
  const [audio, setAudio] = useState({ file: null, url: '' })
  const { file: audioFile, url: audioUrl } = audio
  const audioUrlRef = useRef('')
  const submitting = useRef(false)
  const result = gradeMockExam(exam, answers, manualScores)
  const reviewed = phase === 'results'
  const selectedPassage = exam.passages[passageIndex]
  const activeQuestion = activePart === 'reading' ? exam.reading[questionIndex] : activePart === 'passages' ? selectedPassage.questions[passageQuestionIndex] : activePart === 'listening' ? exam.listening[listeningIndex] : null
  const activeQuestionId = activeQuestion?.id
  const missingListeningKeys = exam.listening.filter((question) => !Object.hasOwn(question.options, question.correctAnswer)).length

  useEffect(() => {
    if (phase !== 'taking') return undefined
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [phase, startedAt])

  useEffect(() => () => { if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current) }, [])

  const setAudioFile = (file) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = file ? URL.createObjectURL(file) : ''
    setAudio({ file, url: audioUrlRef.current })
  }

  const choose = (question, letter) => {
    if (phase === 'taking') setAnswers((previous) => ({ ...previous, [question.id]: letter }))
  }

  const advanceQuestion = () => {
    if (activePart === 'reading') {
      if (questionIndex < exam.reading.length - 1) setQuestionIndex(questionIndex + 1)
      else { setActivePart('passages'); setPassageIndex(0); setPassageQuestionIndex(0) }
    } else if (activePart === 'passages') {
      if (passageQuestionIndex < selectedPassage.questions.length - 1) setPassageQuestionIndex(passageQuestionIndex + 1)
      else if (passageIndex < exam.passages.length - 1) { setPassageIndex(passageIndex + 1); setPassageQuestionIndex(0) }
      else { setActivePart('listening'); setListeningIndex(0) }
    } else if (activePart === 'listening') {
      if (listeningIndex < exam.listening.length - 1) setListeningIndex(listeningIndex + 1)
      else setActivePart('writing')
    }
  }

  const { pendingChoice, clearPending } = useQuestionShortcuts({
    question: activeQuestion,
    answer: activeQuestion ? answers[activeQuestion.id] : null,
    disabled: phase !== 'taking' || activePart === 'writing',
    scope: exam.id,
    onAnswer: (letter) => choose(activeQuestion, letter),
    onNext: advanceQuestion,
  })

  const answerQuestion = (question, letter) => { clearPending(); choose(question, letter) }

  useEffect(() => {
    if (phase === 'taking' && activeQuestionId) document.getElementById(`exam-question-${activeQuestionId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeQuestionId, phase])

  const start = () => {
    setStartedAt(Date.now())
    setPhase('taking')
    setNotice(null)
  }

  const submit = () => {
    if (submitting.current) return
    const remaining = result.unanswered + (writingText.trim() ? 0 : 1)
    if (remaining && !window.confirm(`Còn ${result.unanswered} câu trắc nghiệm chưa trả lời${writingText.trim() ? '' : ' và bài viết đang trống'}. Bạn muốn nộp bài?`)) return
    submitting.current = true
    const duration = Math.floor((Date.now() - startedAt) / 1000)
    try {
      if (user) saveMockExamAttempt(exam, answers, writingText, duration, manualScores)
      setElapsed(duration)
      setPhase('results')
      setNotice(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) { setNotice({ text: error.message, error: true }) }
    finally { submitting.current = false }
  }

  const saveScores = () => {
    const scores = {}
    for (const section of result.sections.filter((part) => part.manual)) {
      const input = scoreInputs[section.id]
      if (input === undefined || String(input).trim() === '') continue
      const value = parseManualScore(input)
      if (value === null) { setNotice({ text: `Điểm ${section.label} phải là một số từ 0 đến ${EXAM_MAX_SCORE}.`, error: true }); return }
      scores[section.id] = value
    }
    try {
      if (user) saveMockExamAttempt(exam, answers, writingText, elapsed, scores)
      setManualScores(scores)
      setNotice({ text: user ? 'Đã lưu điểm và cập nhật kết quả từng phần.' : 'Đã cập nhật kết quả đang xem. Chế độ khách không lưu điểm.', error: false })
    } catch (error) { setNotice({ text: error.message, error: true }) }
  }

  const newExam = () => {
    if (phase === 'taking' && !window.confirm('Bỏ lượt làm bài hiện tại và tạo đề mới?')) return
    if (searchParams.has('attempt')) { navigate('/exam', { replace: true }); return }
    setExam(createMockExam())
    setAnswers({}); setWritingText(''); setManualScores({}); setScoreInputs({})
    setActivePart('reading'); setQuestionIndex(0); setPassageIndex(0); setPassageQuestionIndex(0); setListeningIndex(0)
    setElapsed(0); setNotice(null); setAudioFile(null); setPhase('setup')
  }

  const renderAudio = () => <div className="exam-audio"><label htmlFor="exam-audio-file"><Headphones size={18} aria-hidden="true" /><span>Chọn file nghe của đề trên thiết bị<input id="exam-audio-file" type="file" accept="audio/*" onChange={(event) => { setAudioFile(event.target.files?.[0] || null); event.target.value = '' }} /></span></label>{audioUrl && <audio controls src={audioUrl} aria-label="File nghe của đề thi" preload="metadata" />}<p>{audioFile ? `Đang dùng: ${audioFile.name}. File chỉ được mở trên thiết bị này.` : 'Chưa có âm thanh kèm theo. Hãy dùng file nghe khớp với các câu được chọn; file không tự ghép theo đề ngẫu nhiên.'}</p></div>

  return (
    <div className="page-shell mock-exam-page">
      <div className="page-heading"><div><p className="eyebrow">ĐỀ THI 4 PHẦN</p><h1>Thi thử tổng hợp</h1><p className="page-description">35 câu đọc hiểu · 2 bài đọc văn · 30 câu nghe · 1 bài viết</p></div><Link to="/" className="text-link"><ArrowLeft size={15} aria-hidden="true" />Tổng quan</Link></div>
      {notice && <p className={`notice ${notice.error ? 'notice-error' : 'notice-success'} mb-5`} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}

      {phase === 'setup' ? <>
        <div className="flex flex-wrap gap-3 mb-5"><button type="button" className="btn btn-primary" onClick={start}>Bắt đầu làm bài<ArrowRight size={17} aria-hidden="true" /></button><button type="button" className="btn btn-secondary" onClick={newExam}><RotateCcw size={16} aria-hidden="true" />Đổi đề ngẫu nhiên</button></div>
        <section className="mock-exam-overview" aria-label="Cấu trúc bài thi">{MOCK_EXAM_PARTS.map((part, index) => {
          const Icon = PART_ICONS[part.id]
          return <div className="panel exam-part-preview" key={part.id}><span className="feature-icon"><Icon size={22} aria-hidden="true" /></span><span className="eyebrow">PHẦN {index + 1}</span><h2>{part.label}</h2><p><strong>{part.amount}</strong> {part.unit}</p><small>{part.id === 'writing' ? 'Không tính điểm' : `Thang ${EXAM_MAX_SCORE} · Điểm liệt dưới ${EXAM_PASS_SCORE}`}</small></div>
        })}</section>
        <details className="panel exam-instructions"><summary className="exam-instructions-summary">Quy tắc tính kết quả</summary><ul><li>Đọc hiểu, bài đọc văn và nghe chấm trên thang {EXAM_MAX_SCORE}. Phần nào dưới {EXAM_PASS_SCORE} điểm sẽ hiển thị <strong>Không đạt</strong>.</li><li>Đúng {EXAM_PASS_SCORE} điểm được tính là đạt phần đó. Cả 3 phần chấm điểm phải đạt để kết quả chung là <strong>Đạt</strong>.</li><li>Đọc hiểu và bài đọc văn chấm theo tỉ lệ câu trả lời đúng. Mỗi bài đọc có các câu hỏi đi kèm.</li><li>Phần nghe của đề này có {missingListeningKeys} câu chưa có đáp án. Điểm nghe sẽ được nhập sau khi chấm; để trống sẽ hiện <strong>Chờ chấm</strong>.</li><li>Bài viết không tính điểm và không ảnh hưởng kết quả đạt/không đạt.</li><li>Đáp án được giữ kín đến khi nộp bài. {user ? 'Bài đã nộp và điểm bổ sung được lưu trong lịch sử thi.' : 'Khách chỉ xem kết quả trong lượt làm hiện tại; bài thi và bài viết không được lưu.'}</li></ul></details>
        <details className="panel exam-instructions exam-audio-setup"><summary className="exam-instructions-summary">Thêm file nghe của đề (không bắt buộc)</summary>{renderAudio()}</details>
      </> : <>
        {reviewed && <>
          <section className={`panel mock-result-banner result-${result.status}`} aria-labelledby="mock-result-title"><span className="feature-icon"><Trophy size={25} aria-hidden="true" /></span><div><p className="eyebrow">KẾT QUẢ BÀI THI</p><h2 id="mock-result-title">{STATUS_LABELS[result.status]}</h2><p>{result.status === 'failed' ? 'Có phần dưới 3 điểm. Xem các phần cần ôn lại bên dưới.' : result.status === 'pending' ? 'Cần bổ sung điểm các phần chưa chấm để kết luận.' : 'Cả 3 phần chấm điểm đều đạt từ 3 điểm trở lên.'}</p></div><span className="mock-elapsed"><Clock3 size={16} aria-hidden="true" />{formatDuration(elapsed)}</span></section>
          <section className="panel exam-score-panel" aria-label="Điểm từng phần"><div className="exam-score-table-wrapper"><table className="exam-score-table"><thead><tr><th>Phần thi</th><th>Kết quả trả lời</th><th>Điểm / {EXAM_MAX_SCORE}</th><th>Đánh giá</th></tr></thead><tbody>{result.sections.map((section) => <tr key={section.id}><th scope="row">{section.label}<small>{section.amount} {section.unit}</small></th><td>{section.id === 'writing' ? `${[...writingText].length} ký tự` : section.manual ? `${section.answered}/${section.total} câu đã trả lời` : `${section.correct}/${section.total} câu đúng`}</td><td className="exam-score-value">{section.id === 'writing' ? '—' : displayScore(section.score)}</td><td><span className={`exam-status status-${section.status}`}>{STATUS_LABELS[section.status]}</span></td></tr>)}</tbody></table></div><p className="exam-score-rule">Điểm liệt áp dụng riêng cho từng phần, so sánh trước khi làm tròn điểm hiển thị.</p></section>
          <section className="panel manual-score-panel"><div><h2>Nhập điểm phần nghe sau khi chấm</h2><p>Phần nghe chưa đủ đáp án để tự chấm toàn bộ. Nhập điểm nghe theo kết quả được chấm trên thang 10; để trống nếu chưa có điểm. Bài viết không tính điểm.</p></div><div className="manual-score-fields">{result.sections.filter((section) => section.manual).map((section) => <label key={section.id} htmlFor={`score-${section.id}`}><span>Điểm {section.label} (0–{EXAM_MAX_SCORE})</span><input id={`score-${section.id}`} type="number" min="0" max={EXAM_MAX_SCORE} step="0.01" inputMode="decimal" placeholder="Chưa chấm" value={scoreInputs[section.id] ?? ''} onChange={(event) => setScoreInputs((previous) => ({ ...previous, [section.id]: event.target.value }))} /></label>)}<button type="button" className="btn btn-primary" onClick={saveScores}><Save size={16} aria-hidden="true" />{user ? 'Lưu điểm và cập nhật kết quả' : 'Cập nhật kết quả đang xem'}</button></div></section>
        </>}

        <div className="mock-exam-toolbar"><nav className="mock-part-tabs" aria-label="Chọn phần thi">{MOCK_EXAM_PARTS.map((part, index) => <button key={part.id} type="button" aria-pressed={activePart === part.id} className={activePart === part.id ? 'is-active' : ''} onClick={() => setActivePart(part.id)}><span>{index + 1}</span>{part.label}</button>)}</nav><span className="quiz-clock" role="timer" aria-label="Thời gian làm bài"><Clock3 size={18} aria-hidden="true" />{formatDuration(elapsed)}</span></div>

        {phase === 'taking' && activeQuestion && <p className="keyboard-hint mb-4" aria-live="polite">{pendingChoice ? `Đang chọn ${pendingChoice} · Space để trả lời` : '1 / 2 / 3 / 4 chọn đáp án · Space để trả lời, nhấn tiếp để chuyển câu'}</p>}<div className="mock-exam-layout"><div className="min-w-0">
          {activePart === 'reading' && <><ExamQuestion question={exam.reading[questionIndex]} pendingChoice={pendingChoice} number={questionIndex + 1} total={35} answers={answers} reviewed={reviewed} choose={answerQuestion} /><QuestionNavigation index={questionIndex} total={35} onChange={setQuestionIndex} /><QuestionMap questions={exam.reading} answers={answers} currentIndex={questionIndex} onChange={setQuestionIndex} /></>}
          {activePart === 'passages' && <><div className="flex flex-wrap gap-2 mb-4">{exam.passages.map((passage, index) => <button type="button" key={passage.id} className={`btn ${passageIndex === index ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={passageIndex === index} onClick={() => { setPassageIndex(index); setPassageQuestionIndex(0) }}>Bài {index + 1} · {passage.questions.length} câu</button>)}</div><article className="panel exam-passage"><p className="eyebrow">BÀI ĐỌC VĂN {passageIndex + 1}/2</p><h2 className="jp">{selectedPassage.title}</h2><p className="jp whitespace-pre-wrap">{selectedPassage.passage}</p></article><div className="space-y-4 mt-5">{selectedPassage.questions.map((question, index) => <ExamQuestion key={question.id} question={question} active={passageQuestionIndex === index} onActivate={() => setPassageQuestionIndex(index)} pendingChoice={passageQuestionIndex === index ? pendingChoice : null} number={index + 1} total={selectedPassage.questions.length} answers={answers} reviewed={reviewed} choose={answerQuestion} />)}</div></>}
          {activePart === 'listening' && <><section className="panel exam-listening-note"><h2><Headphones size={19} aria-hidden="true" />Phần nghe · 30 câu</h2><p>Đề hiện chưa kèm âm thanh và còn {missingListeningKeys} câu thiếu đáp án. Các lựa chọn được giữ để làm bài; điểm toàn phần cần nhập sau khi được chấm.</p>{renderAudio()}</section><ExamQuestion question={exam.listening[listeningIndex]} pendingChoice={pendingChoice} number={listeningIndex + 1} total={30} answers={answers} reviewed={reviewed} choose={answerQuestion} /><QuestionNavigation index={listeningIndex} total={30} onChange={setListeningIndex} /><QuestionMap questions={exam.listening} answers={answers} currentIndex={listeningIndex} onChange={setListeningIndex} /></>}
          {activePart === 'writing' && <section className="panel exam-writing"><p className="eyebrow">PHẦN VIẾT · 1 BÀI · KHÔNG TÍNH ĐIỂM</p><h2 className="jp">{exam.writing.title}</h2><p className="text-[var(--muted)]">{exam.writing.titleVi}</p><details className="writing-prompts"><summary>Các ý cần triển khai trong bài viết</summary><ol>{exam.writing.prompts.map((prompt) => <li key={prompt.q} className="jp">{prompt.q}</li>)}</ol></details><label htmlFor="exam-writing-text">Bài viết tiếng Nhật của bạn</label><textarea id="exam-writing-text" className="jp" value={writingText} readOnly={reviewed} onChange={(event) => setWritingText(event.target.value)} placeholder="Viết bài tại đây…" /><p className="text-sm text-[var(--muted)] mt-2">{[...writingText].length} ký tự · {!user ? 'Chế độ khách không lưu bài viết. Phần viết không tính điểm.' : reviewed ? 'Bài đã được lưu. Phần viết không tính điểm.' : 'Bài viết được lưu khi bạn nộp toàn bộ bài thi.'}</p>{reviewed && <details className="writing-prompts"><summary>Đối chiếu bài mẫu sau khi thi</summary><p className="jp whitespace-pre-wrap">{exam.writing.sample}</p></details>}</section>}
        </div>

        <aside className="panel mock-exam-sidebar"><h2>{reviewed ? 'Xem lại bài thi' : 'Tiến độ làm bài'}</h2>{MOCK_EXAM_PARTS.map((part) => {
          const total = part.id === 'writing' ? 1 : part.id === 'passages' ? exam.passages.reduce((count, passage) => count + passage.questions.length, 0) : exam[part.id].length
          const answered = part.id === 'writing' ? Number(Boolean(writingText.trim())) : gradeExam(part.id === 'passages' ? exam.passages.flatMap((passage) => passage.questions) : exam[part.id], answers).answered
          return <button key={part.id} type="button" className="mock-progress-row" onClick={() => setActivePart(part.id)}><span>{part.label}</span><strong>{answered}/{total}</strong></button>
        })}<p>Ba phần chấm điểm cần đạt từ {EXAM_PASS_SCORE}/{EXAM_MAX_SCORE}. Bài viết không tính điểm.</p>{reviewed ? <><button type="button" className="btn btn-secondary w-full" onClick={newExam}><RotateCcw size={16} aria-hidden="true" />Làm đề mới</button><Link className="text-link mt-4" to="/">Về lịch sử thi<ArrowRight size={15} aria-hidden="true" /></Link></> : <button type="button" className="btn btn-primary w-full" onClick={submit}><Send size={16} aria-hidden="true" />Nộp toàn bộ bài thi</button>}</aside></div>
      </>}
    </div>
  )
}

function ExamQuestion({ question, number, total, answers, reviewed, choose, pendingChoice, active = false, onActivate }) {
  const pick = answers[question.id]
  const known = Object.hasOwn(question.options, question.correctAnswer)
  return <section id={`exam-question-${question.id}`} className={`panel question-card ${active ? 'shortcut-active' : ''}`} onFocus={onActivate} onPointerDown={onActivate}><div className="question-meta"><span>Câu {number}/{total}</span>{reviewed && known && <span>{!pick ? 'Chưa trả lời' : String(pick) === String(question.correctAnswer) ? 'Đúng' : 'Sai'}</span>}{!known && <span className="listening-unscored">Chưa có đáp án · Không chấm tự động</span>}</div>{question.image && <img src={question.image} alt={`Hình minh họa câu ${number}`} className="mb-5 max-h-64 rounded-lg object-contain" />}<h3 className="jp question-text"><QuestionText text={question.questionText} /></h3><div className="answer-list">{Object.entries(question.options).map(([letter, text]) => {
    const selected = (pendingChoice || pick) === letter
    let state = selected ? 'is-selected' : ''
    if (reviewed && known) {
      if (String(letter) === String(question.correctAnswer)) state = 'is-correct'
      else if (selected) state = 'is-wrong'
    }
    return <button key={letter} type="button" className={`answer-option ${state}`} aria-pressed={selected} disabled={reviewed} onClick={() => choose(question, letter)}><span className="answer-letter">{letter}</span><span className="jp flex-1">{text}</span>{state === 'is-correct' && <CheckCircle2 size={18} aria-label="Đáp án đúng" />}</button>
  })}</div>{reviewed && known && <div className={`answer-feedback ${String(pick) === String(question.correctAnswer) ? 'feedback-correct' : 'feedback-wrong'}`}><strong>Đáp án: {question.correctAnswer}</strong>{question.explanation && <p>{question.explanation}</p>}</div>}{reviewed && !known && <p className="mt-4 text-sm text-[var(--muted)]">Chưa có đáp án để đối chiếu câu này.</p>}</section>
}

function QuestionNavigation({ index, total, onChange }) {
  return <div className="quiz-navigation"><button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => onChange(index - 1)}><ArrowLeft size={16} aria-hidden="true" />Câu trước</button><span>{index + 1}/{total}</span><button type="button" className="btn btn-primary" disabled={index === total - 1} onClick={() => onChange(index + 1)}>Câu tiếp<ArrowRight size={16} aria-hidden="true" /></button></div>
}

function QuestionMap({ questions, answers, currentIndex, onChange }) {
  return <nav className="panel mock-question-map" aria-label="Chuyển nhanh câu hỏi"><div className="question-grid">{questions.map((question, index) => <button key={question.id} type="button" aria-label={`Câu ${index + 1}, ${answers[question.id] ? 'đã trả lời' : 'chưa trả lời'}`} aria-current={index === currentIndex ? 'step' : undefined} className={`${answers[question.id] ? 'is-answered' : ''} ${index === currentIndex ? 'is-current' : ''}`} onClick={() => onChange(index)}>{index + 1}</button>)}</div></nav>
}
