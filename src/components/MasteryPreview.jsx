import QuestionText from './QuestionText.jsx'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { flashcards } from '../data/index.js'
import { findLesson, lessonQuestions } from '../utils/roadmapContent.js'
import { cardKey, enterNodeRound, LEVEL_LABELS, needsRecheck, nodeLearningDecision } from '../utils/masteryLearning.js'
import { getMasteryProgress, saveMasteryProgress } from '../utils/storage.js'
import { usableQuestion } from '../utils/questionUsability.js'
import { useAuth } from '../context/authContext.js'
import useStudyShortcuts from '../hooks/useStudyShortcuts.js'

const updateId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`

export default function MasteryPreview() {
  const { stageId, nodeId } = useParams()
  const lesson = findLesson(stageId, nodeId)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [progress, setProgress] = useState(() => getMasteryProgress())
  const [error, setError] = useState('')
  useEffect(() => { const refresh = () => setProgress(getMasteryProgress()); window.addEventListener('n3vjit:progress', refresh); return () => window.removeEventListener('n3vjit:progress', refresh) }, [])
  const keys = lesson?.questions.filter(usableQuestion).map(cardKey) || []
  const sessionKey = `${stageId}:${nodeId}`
  const session = progress.nodes[sessionKey]
  const decision = nodeLearningDecision(keys, progress.cards, session)
  const buttonLabel = decision.action === 'start' ? 'Bắt đầu làm bài' : decision.action === 'resume' ? `Tiếp tục vòng ${decision.round}` : decision.action === 'review' ? `Ôn ${decision.weakCount} thẻ cần củng cố` : 'Xem kết quả'
  const start = () => {
    if (!lesson || !user) return
    const oldKeys = lesson.stage.lessons.slice(0, lesson.index).flatMap((_, index) => lessonQuestions(lesson.stage, index).filter(usableQuestion).map(cardKey))
    const entry = enterNodeRound(keys, oldKeys, progress.cards, session, Date.now(), updateId())
    try {
      if (entry.action === 'start' || entry.action === 'review') saveMasteryProgress({ ...progress, nodes: { ...progress.nodes, [sessionKey]: entry.session } })
      navigate(`/study/${stageId}/${nodeId}/${entry.action === 'summary' ? 'summary' : 'learn'}`)
    } catch (cause) { setError(cause.message) }
  }
  useStudyShortcuts({ mode: 'preview', onExit: () => navigate('/'), onStart: lesson && user ? start : null })
  if (!lesson) return <section className="page-shell"><p>Không tìm thấy bài học này.</p><Link to="/">Trở về lộ trình</Link></section>
  const allCards = Object.values(flashcards).flat()
  return <div className="page-shell mastery-page">
    <Link className="text-link" to="/" aria-keyshortcuts="Escape"><ArrowLeft size={16}/> Trở về lộ trình</Link>
    <header className="mastery-head"><p className="eyebrow">XEM TRƯỚC BÀI HỌC · {lesson.stage.title}</p><h1>{lesson.stage.lessons[lesson.index]}</h1><p>Ôn nội dung trước khi bắt đầu · {lesson.questions.length} thẻ</p></header>
    {!user && <div className="notice">Đăng nhập để học và lưu tiến độ của bạn. <Link to="/login">Đăng nhập</Link></div>}
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    <div className="mastery-preview-list">{lesson.questions.map((question, index) => {
      const linked = allCards.find(card => card.id.endsWith(`_${question.id}`))
      const card = progress.cards[cardKey(question)]
      return <article className="panel mastery-preview-card" key={question.id}><span className="mastery-card-number">{index + 1}</span><div>{card && <span className={`mastery-level lv${card.level}`}>{needsRecheck(card) ? 'Cần kiểm tra lại' : LEVEL_LABELS[card.level]}</span>}<h2 className="jp"><QuestionText text={question.questionText} /></h2><p><strong>Đáp án:</strong> <span className="jp">{question.options?.[question.correctAnswer]}</span></p>{question.explanation && <p>{question.explanation}</p>}{linked && (linked.note || linked.back) !== question.explanation && <p className="jp">{linked.note || linked.back}</p>}</div></article>
    })}</div>
    {user ? <button type="button" className="btn btn-primary mastery-start" aria-keyshortcuts="Enter" onClick={start} disabled={!keys.length}>{buttonLabel} <ArrowRight size={16}/></button> : <Link className="btn btn-primary mastery-start" to="/login">Đăng nhập để học</Link>}
  </div>
}
