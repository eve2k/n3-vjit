import QuestionText from './QuestionText.jsx'
import { useState, useEffect, useRef } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/authContext.js'
import { findLesson, lessonQuestions } from '../utils/roadmapContent.js'
import { cardKey, createRound, answerCard, advanceAfterFeedback, LEVEL_LABELS, nodeStatus } from '../utils/masteryLearning.js'
import { getMasteryProgress, saveMasteryProgress } from '../utils/storage.js'
import useStudyShortcuts from '../hooks/useStudyShortcuts.js'
import { speakJapanese } from '../utils/tts.js'
import { questionInstruction, plainQuestionText } from '../utils/questionMarkup.js'
import { usableQuestion } from '../utils/questionUsability.js'
import SpeakButton from './SpeakButton.jsx'

const updateId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
function shuffleOptions(options, seed) {
  const list = Object.entries(options || {})
  let hash = [...seed].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 2166136261)
  for (let i = list.length - 1; i > 0; i--) { hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0; const j = hash % (i + 1); [list[i], list[j]] = [list[j], list[i]] }
  return list
}
export default function MasteryStudy() {
  const { stageId, nodeId } = useParams()
  const { user } = useAuth()
  const lesson = findLesson(stageId, nodeId)
  if (!lesson) return <section className="page-shell"><p>Không tìm thấy bài học này.</p><Link to="/">Trở về lộ trình</Link></section>
  if (!user) return <section className="page-shell"><p>Đăng nhập để học và lưu tiến độ.</p><Link to="/login" className="btn btn-primary">Đăng nhập</Link></section>
  return <MasterySession key={`${stageId}:${nodeId}`} stageId={stageId} nodeId={nodeId} lesson={lesson} />
}

function MasterySession({ stageId, nodeId, lesson }) {
  const navigate = useNavigate()
  const key = `${stageId}:${nodeId}`
  const [helpOpen, setHelpOpen] = useState(false)
  const helpCloseRef = useRef(null)
  const [progress, setProgress] = useState(() => getMasteryProgress())
  const [error, setError] = useState('')
  useEffect(() => { const refresh = () => setProgress(getMasteryProgress()); window.addEventListener('n3vjit:progress', refresh); return () => window.removeEventListener('n3vjit:progress', refresh) }, [])
  useEffect(() => { if (helpOpen) helpCloseRef.current?.focus() }, [helpOpen])
  const all = lesson.stage.lessons.flatMap((_, index) => lessonQuestions(lesson.stage, index)).filter(usableQuestion)
  const questionById = Object.fromEntries(all.map(q => [cardKey(q), q]))
  const keys = lesson.questions.filter(usableQuestion).map(cardKey)
  const oldKeys = lesson.stage.lessons.slice(0, lesson.index).flatMap((_, index) => lessonQuestions(lesson.stage, index).filter(usableQuestion).map(cardKey))
  const session = progress.nodes[key]
  const status = nodeStatus(keys, progress.cards, session?.completedRounds || 0)
  const save = (next) => { try { saveMasteryProgress(next); setProgress(next); setError(''); return true } catch (e) { setError(e.message); return false } }
  const startRound = () => {
    const next = createRound(keys, oldKeys, progress.cards, session ? session.round + 1 : 1, session?.completedRounds || 0, Date.now(), updateId())
    save({ ...progress, nodes: { ...progress.nodes, [key]: next } })
  }
  const currentKey = session?.feedback?.key || session?.queue[0]
  const question = questionById[currentKey]
  const seed = `${session?.round}:${currentKey}:${session?.requeues?.[currentKey] || 0}`
  const options = session?.feedback?.options || shuffleOptions(question?.options, seed)
  const respond = letter => {
    if (!question || session.feedback) return
    const result = answerCard(session, progress.cards, letter === question.correctAnswer, Date.now(), updateId())
    result.session.feedback = { ...result.session.feedback, selected: letter, options }
    save({ cards: result.cards, nodes: { ...progress.nodes, [key]: result.session } })
  }
  const next = () => { const finished = session.queue.length === 0; const updated = advanceAfterFeedback(session, Date.now(), updateId(), progress.cards); if (save({ ...progress, nodes: { ...progress.nodes, [key]: updated } }) && finished) navigate(`/study/${stageId}/${nodeId}/summary`) }
  useStudyShortcuts({
    mode: 'study', helpOpen, onHelp: () => setHelpOpen(value => !value),
    onExit: () => { if (window.confirm('Thoát bài học? Tiến độ đã trả lời vẫn được lưu.')) navigate(`/study/${stageId}/${nodeId}`) },
    optionCount: options.length, answered: !!session?.feedback, answeredAt: session?.feedback ? Date.parse(session.updatedAt) : null,
    onChoose: question && session && !session.feedback ? index => respond(options[index][0]) : null,
    onAdvance: session?.feedback ? next : null,
    onSpeak: question ? () => speakJapanese(plainQuestionText(question.questionText)) : null,
  })
  if (!keys.length) return <section className="page-shell"><p>Bài học chưa có câu hỏi hợp lệ để luyện. Hãy quay lại lộ trình.</p><Link to="/" className="btn btn-secondary">Về lộ trình</Link></section>
  if (session && !session.feedback && session.queue.length === 0) return <Navigate to={`/study/${stageId}/${nodeId}/summary`} replace />
  return <div className="page-shell mastery-study">
    <Link className="text-link" aria-keyshortcuts="Escape" to={`/study/${stageId}/${nodeId}`}><ArrowLeft size={16}/> Trở về bài học</Link>
    <header className="mastery-study-head"><div><p className="eyebrow">{lesson.stage.title} · {lesson.stage.lessons[lesson.index]}</p><h1>Học bốn bậc</h1></div><div className="mastery-header-actions">{session && <span>Vòng {session.round}</span>}<button type="button" className="mastery-shortcuts-help" onClick={() => setHelpOpen(true)} aria-keyshortcuts="Shift+/" aria-label="Xem phím tắt">?</button></div></header>
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {!session ? <section className="panel mastery-finish"><h2>Sẵn sàng học?</h2><p>Mỗi vòng giúp bạn củng cố kiến thức và theo dõi bốn bậc ghi nhớ.</p><button className="btn btn-primary" onClick={startRound}>Bắt đầu vòng 1</button></section> : !currentKey ? <section className="panel mastery-finish"><h2>{status.mastered ? 'Đã thành thạo bài học!' : `Hoàn thành vòng ${session.round}`}</h2><p>{status.mastered ? 'Tất cả thẻ đã đạt thành thạo.' : status.passed ? 'Bạn đã qua node. Bạn có thể học tiếp để củng cố.' : 'Tiếp tục vòng sau để củng cố các thẻ còn yếu.'}</p><p>{status.counts[3]}/{status.total} thẻ thành thạo</p>{!status.mastered && <button className="btn btn-primary" onClick={startRound}>Bắt đầu vòng tiếp <ArrowRight size={16}/></button>} <Link className="btn btn-secondary" to="/">Về lộ trình</Link></section> : !question ? <section className="panel mastery-finish"><p>Câu hỏi này không còn trong dữ liệu. Hãy quay về lộ trình.</p><Link to="/">Trở về lộ trình</Link></section> : <>
      <div className="mastery-progress" aria-label={`Đã trả lời ${session.answered} trên ${session.total} lượt trong vòng`}><span>{session.answered}/{session.total}</span><div><i style={{ width: `${session.total ? session.answered / session.total * 100 : 0}%` }}/></div></div>
      <section className="panel mastery-question"><div className="mastery-question-top"><span className={`mastery-level lv${session.feedback?.previousLevel ?? progress.cards[currentKey]?.level ?? 0}`}>{LEVEL_LABELS[session.feedback?.previousLevel ?? progress.cards[currentKey]?.level ?? 0]}</span><span>{questionInstruction(question)}</span><SpeakButton text={question.questionText} shortcuts="S" /></div><h2 className="jp"><QuestionText text={question.questionText} /></h2><div className="mastery-answers">{options.map(([letter, text], index) => { const feedback = session.feedback; const answerClass = feedback ? letter === question.correctAnswer ? 'correct' : letter === feedback.selected ? 'wrong' : '' : ''; return <button className={`mastery-answer ${answerClass}`} key={letter} disabled={!!feedback} aria-keyshortcuts={String(index + 1)} onClick={() => respond(letter)}><b className="mastery-answer-key" aria-hidden="true">{index + 1}</b><span className="jp">{text}</span></button> })}</div>
        {session.feedback && <div className={`mastery-feedback ${session.feedback.correct ? 'correct' : 'wrong'}`} role="status"><strong>{session.feedback.correct ? 'Chính xác!' : `Đáp án đúng: ${question.options[question.correctAnswer]}`}</strong><p>{LEVEL_LABELS[session.feedback.previousLevel]} → {LEVEL_LABELS[session.feedback.level]}</p>{!session.feedback.correct && question.explanation && <p>{question.explanation}</p>}<button className="btn btn-primary" data-shortcut-advance aria-keyshortcuts="Enter Space" onClick={next}>Tiếp tục <ArrowRight size={16}/></button></div>}
      </section></>}
    {helpOpen && <div className="mastery-help-backdrop" onClick={() => setHelpOpen(false)}><section className="panel mastery-help-dialog" role="dialog" aria-modal="true" aria-labelledby="mastery-help-title" onClick={event => event.stopPropagation()}><h2 id="mastery-help-title">Phím tắt</h2><dl><div><dt>1–4</dt><dd>Chọn đáp án (kể cả bàn phím số)</dd></div><div><dt>Enter / Space</dt><dd>Qua câu sau khi đã trả lời</dd></div><div><dt>S</dt><dd>Phát âm câu hỏi</dd></div><div><dt>Esc</dt><dd>Thoát bài học</dd></div><div><dt>?</dt><dd>Mở hoặc đóng bảng phím tắt</dd></div></dl><button ref={helpCloseRef} className="btn btn-secondary" onClick={() => setHelpOpen(false)} aria-keyshortcuts="Escape">Đóng</button></section></div>}
  </div>
}
