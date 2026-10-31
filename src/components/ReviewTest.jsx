import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, Trophy } from 'lucide-react'
import { useAuth } from '../context/authContext.js'
import useReviewProgress from '../hooks/useReviewProgress.js'
import useStudyShortcuts from '../hooks/useStudyShortcuts.js'
import { stages } from '../utils/roadmapContent.js'
import { reviewCatalog, gradeReviewAnswer, correctAnswerText } from '../utils/reviewLearning.js'
import { reviewCursor } from '../utils/reviewProgress.js'
import { saveReviewAnswer, advanceReviewQuestion, finishReviewTest } from '../utils/storage.js'
import { ADVANCE_DELAY_MS } from '../utils/studyShortcuts.js'
import { questionInstruction, plainQuestionText } from '../utils/questionMarkup.js'
import { speakJapanese } from '../utils/tts.js'
import QuestionText from './QuestionText.jsx'
import SpeakButton from './SpeakButton.jsx'
import SyncStatus from './SyncStatus.jsx'

export default function ReviewTest() {
  const { user } = useAuth()
  const { review } = useReviewProgress()
  const [result, setResult] = useState(null)
  const session = review.session
  if (!user) return <div className="page-shell review-page"><section className="panel weak-empty"><h1>Đăng nhập để kiểm tra</h1><Link className="btn btn-primary" to="/login">Đăng nhập</Link></section></div>
  if (result) return <ReviewResult result={result}/>
  if (!session?.data) return <div className="page-shell review-page"><section className="panel weak-empty"><CheckCircle2 size={28}/><h1>{session ? 'Phiên kiểm tra đã đóng' : 'Chưa có bài kiểm tra'}</h1><p>{session ? 'Nếu vừa hoàn thành, kết quả từng câu đã được lưu. Đề và câu trả lời của phiên đã được dọn.' : 'Chọn một chặng và thiết lập bài kiểm tra để bắt đầu.'}</p><Link className="btn btn-primary" to="/review">Về ôn tập</Link></section></div>
  const cursor = reviewCursor(session)
  const item = session.data.items[cursor]
  const question = reviewCatalog(session.data.stageId).find(q => q.key === item.key)
  if (!question) return <div className="page-shell review-page"><p>Câu hỏi đã thay đổi. Hãy quay lại trang Ôn tập để hủy phiên cũ và tạo đề mới.</p><Link to="/review">Về ôn tập</Link></div>
  return <ReviewQuestion key={`${session.id}:${cursor}`} session={session} cursor={cursor} item={item} question={question} onFinish={setResult}/>
}

function ReviewQuestion({ session, cursor, item, question, onFinish }) {
  const navigate = useNavigate()
  const stage = stages.find(stage => stage.id === session.data.stageId)
  const answer = session.data.answers[item.key]
  const [text, setText] = useState(answer?.response || '')
  const [error, setError] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [unlockedStamp, setUnlockedStamp] = useState('')
  const nextRef = useRef(null)
  const inputRef = useRef(null)
  const helpRef = useRef(null)
  const last = cursor === session.data.items.length - 1
  const answered = Boolean(answer)
  const correct = answered && gradeReviewAnswer(item, question, answer.response, answer.selfCorrected)
  const canAdvance = answered && unlockedStamp === session.updatedAt
  const choices = item.mode === 'true-false' ? [[true, 'Đúng'], [false, 'Sai']] : item.mode === 'multiple-choice' ? item.choices.map(letter => [letter, question.options[letter]]) : []
  useEffect(() => {
    if (!answered) { inputRef.current?.focus(); return }
    nextRef.current?.focus()
    const delay = Math.max(0, ADVANCE_DELAY_MS - (Date.now() - Date.parse(session.updatedAt)))
    const timer = setTimeout(() => setUnlockedStamp(session.updatedAt), delay)
    return () => clearTimeout(timer)
  }, [answered, session.updatedAt])
  useEffect(() => {
    if (helpOpen) helpRef.current?.showModal()
    else helpRef.current?.close()
  }, [helpOpen])
  const respond = (response, selfCorrected = false) => {
    if (answered && !selfCorrected) return
    try { saveReviewAnswer(session.id, item.key, response, { selfCorrected }); setError('') } catch (failure) { setError(failure.message) }
  }
  const advance = () => {
    if (!canAdvance) return
    try {
      if (last) {
        const summary = finishReviewTest(session.id)
        if (summary) onFinish({ ...summary, stageId: stage.id })
      } else advanceReviewQuestion(session.id)
      setError('')
    } catch (failure) { setError(failure.message) }
  }
  const exit = () => { if (window.confirm('Rời bài kiểm tra? Các câu đã trả lời được giữ để bạn tiếp tục sau.')) navigate('/review') }
  useStudyShortcuts({ mode: 'study', helpOpen, onHelp: () => setHelpOpen(value => !value), onExit: exit,
    optionCount: choices.length, answered, answeredAt: answered ? Date.parse(session.updatedAt) : null,
    onChoose: index => respond(choices[index][0]), onAdvance: advance,
    onSpeak: () => speakJapanese(plainQuestionText(question.questionText)),
  })
  return <div className="page-shell review-test-page">
    <div className="review-test-top"><button className="text-link" onClick={exit} aria-keyshortcuts="Escape"><ArrowLeft size={16}/> Rời bài kiểm tra</button><button className="mastery-shortcuts-help" onClick={() => setHelpOpen(true)} aria-label="Phím tắt" aria-keyshortcuts="Shift+/">?</button></div>
    <header className="review-test-heading"><p className="eyebrow">{stage.title} · {session.data.kind === 'retry' ? 'ÔN THẺ SAI' : 'KIỂM TRA TRÍ NHỚ'}</p><h1>{item.mode === 'written' ? 'Tự luận' : item.mode === 'true-false' ? 'Đúng / Sai' : 'Trắc nghiệm'}</h1><p>Câu {cursor + 1}/{session.data.items.length} · {question.lessonTitle}</p></header>
    <div className="review-meter" role="progressbar" aria-label="Số câu đã trả lời" aria-valuemin={0} aria-valuemax={session.data.items.length} aria-valuenow={Object.keys(session.data.answers).length}><span style={{ width: `${Object.keys(session.data.answers).length / session.data.items.length * 100}%` }}/></div>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <section className="panel review-question">
      <div className="review-question-meta"><p>{item.mode === 'true-false' ? 'Câu hỏi và đáp án dưới đây có khớp nhau không?' : item.mode === 'written' ? 'Gõ đáp án từ trí nhớ của bạn' : questionInstruction(question)}</p><SpeakButton text={plainQuestionText(question.questionText)} shortcuts="S"/></div>
      {question.passageText && <details className="review-passage" open><summary>Đoạn văn</summary><p className="jp"><QuestionText text={question.passageText} /></p></details>}
      <h2 className="jp"><QuestionText text={question.questionText}/></h2>
      {item.mode === 'true-false' && <div className="review-proposed-answer"><span>Đáp án được đề xuất</span><p className="jp"><QuestionText text={question.options[item.candidate]}/></p></div>}
      {item.mode === 'written' ? <form className="review-written" onSubmit={event => { event.preventDefault(); if (!answered && text.trim()) respond(text) }}><label htmlFor="review-written-answer">Câu trả lời của bạn</label><input ref={inputRef} id="review-written-answer" value={text} onChange={event => setText(event.target.value)} readOnly={answered} autoComplete="off" spellCheck={false} maxLength={2000} className="jp" placeholder="Nhập đáp án…"/>{!answered && <button className="btn btn-primary" type="submit" disabled={!text.trim()}>Nộp câu trả lời</button>}</form>
        : <div className="mastery-answers review-answers">{choices.map(([value, label], index) => {
          const isCorrect = gradeReviewAnswer(item, question, value)
          const chosen = answered && answer.response === value
          return <button key={String(value)} className={`mastery-answer${answered && isCorrect ? ' correct' : chosen ? ' wrong' : ''}`} onClick={() => respond(value)} disabled={answered} aria-keyshortcuts={String(index + 1)} aria-pressed={chosen}><b className="mastery-answer-key" aria-hidden="true">{index + 1}</b><span className={item.mode === 'true-false' ? '' : 'jp'}><QuestionText text={label}/></span>{answered && (isCorrect ? <span className="review-choice-status">Đáp án đúng</span> : chosen ? <span className="review-choice-status">Bạn đã chọn</span> : null)}</button>
        })}</div>}
      {answered && <div className={`mastery-feedback review-feedback ${correct ? 'correct' : 'wrong'}`} role="status"><strong>{correct ? 'Chính xác!' : 'Chưa chính xác'}</strong><p>Đáp án đúng: <span className="jp"><QuestionText text={correctAnswerText(question)}/></span></p>{question.explanation && <p>{question.explanation}</p>}{answer.selfCorrected && <p>Bạn đã tự xác nhận câu trả lời đúng.</p>}
        <div className="review-actions">{item.mode === 'written' && !correct && <button className="btn btn-secondary" onClick={() => respond(answer.response, true)}>Tôi đã đúng</button>}<button ref={nextRef} className="btn btn-primary" data-shortcut-advance aria-keyshortcuts="Enter Space" aria-disabled={!canAdvance} onClick={advance}>{last ? 'Hoàn thành bài kiểm tra' : 'Câu tiếp'} <ArrowRight size={16}/></button></div>
      </div>}
    </section>
    <p className="review-note">Kết quả được chốt vào tiến độ khi bạn hoàn thành toàn bộ bài kiểm tra.</p>
    <dialog ref={helpRef} className="panel review-help" onCancel={event => { event.preventDefault(); setHelpOpen(false) }} aria-labelledby="review-help-title"><h2 id="review-help-title">Phím tắt</h2><p>1–4: chọn đáp án (kể cả numpad).</p><p>Đúng/Sai: 1 là Đúng, 2 là Sai.</p><p>Enter / Space: qua câu sau khi xem phản hồi ít nhất 500ms.</p><p>S: phát âm · Esc: rời bài · ?: mở trợ giúp.</p><p>Phím tắt không kích hoạt khi bạn đang nhập câu trả lời.</p><button className="btn btn-primary" onClick={() => setHelpOpen(false)}>Đóng</button></dialog>
  </div>
}

function ReviewResult({ result }) {
  const navigate = useNavigate()
  const stage = stages.find(stage => stage.id === result.stageId)
  const wrong = reviewCatalog(stage.id).filter(q => result.wrongKeys.includes(q.key))
  const canRetry = result.kind === 'mastered' && wrong.length > 0
  const retry = () => navigate(`/review?tab=mastered&stage=${stage.id}&setup=1`, { state: { retryKeys: result.wrongKeys } })
  const primary = () => canRetry ? retry() : navigate(result.kind === 'retry' ? '/review' : `/review?tab=mastered&stage=${stage.id}`)
  useStudyShortcuts({ mode: 'preview', onStart: primary, onExit: () => navigate('/review') })
  return <div className="page-shell review-result-page"><section className="panel review-result">
    <div className="review-result-icon">{wrong.length ? <ClipboardResult/> : <Trophy size={32}/>}</div><p className="eyebrow">{stage.title} · KẾT QUẢ KIỂM TRA</p><h1>{wrong.length ? 'Cùng củng cố thêm nhé' : 'Bạn nhớ rất tốt!'}</h1>
    <div className="review-score-grid"><div><strong>{result.correct}</strong><span>Câu đúng</span></div><div><strong>{result.total - result.correct}</strong><span>Câu sai</span></div></div>
    <SyncStatus/>
    {wrong.length > 0 && <section className="review-result-wrong"><h2>Các thẻ cần ôn lại</h2><ul>{wrong.map(q => <li key={q.key}><p className="jp"><QuestionText text={q.questionText}/></p><p className="review-card-answer">Đáp án: <span className="jp"><QuestionText text={correctAnswerText(q)}/></span></p></li>)}</ul></section>}
    <div className="review-actions"><button className="btn btn-primary" aria-keyshortcuts="Enter" onClick={primary}>{canRetry ? <><RotateCcw size={16}/> Ôn lại các thẻ sai</> : result.kind === 'retry' ? 'Đến Cần củng cố' : 'Về danh sách thẻ'}</button><Link className="btn btn-secondary" to="/review" aria-keyshortcuts="Escape">Về ôn tập</Link></div>
  </section></div>
}

function ClipboardResult() { return <CheckCircle2 size={32}/> }
