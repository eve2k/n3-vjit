import QuestionText from './QuestionText.jsx'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { flashcards } from '../data/index.js'
import { findLesson } from '../utils/roadmapContent.js'
import { useAuth } from '../context/authContext.js'
import useStudyShortcuts from '../hooks/useStudyShortcuts.js'

export default function MasteryPreview() {
  const { stageId, nodeId } = useParams()
  const lesson = findLesson(stageId, nodeId)
  const { user } = useAuth()
  const navigate = useNavigate()
  useStudyShortcuts({ mode: 'preview', onExit: () => navigate('/'), onStart: lesson && user ? () => navigate(`/study/${stageId}/${nodeId}/learn`) : null })
  if (!lesson) return <section className="page-shell"><p>Không tìm thấy bài học này.</p><Link to="/">Trở về lộ trình</Link></section>
  const allCards = Object.values(flashcards).flat()
  return <div className="page-shell mastery-page">
    <Link className="text-link" to="/" aria-keyshortcuts="Escape"><ArrowLeft size={16}/> Trở về lộ trình</Link>
    <header className="mastery-head"><p className="eyebrow">XEM TRƯỚC BÀI HỌC · {lesson.stage.title}</p><h1>{lesson.stage.lessons[lesson.index]}</h1><p>Ôn nội dung trước khi bắt đầu · {lesson.questions.length} thẻ</p></header>
    {!user && <div className="notice">Đăng nhập để học và lưu tiến độ của bạn. <Link to="/login">Đăng nhập</Link></div>}
    <div className="mastery-preview-list">{lesson.questions.map((question, index) => {
      const linked = allCards.find(card => card.id.endsWith(`_${question.id}`))
      return <article className="panel mastery-preview-card" key={question.id}><span className="mastery-card-number">{index + 1}</span><div><h2 className="jp"><QuestionText text={question.questionText} /></h2><p><strong>Đáp án:</strong> <span className="jp">{question.options?.[question.correctAnswer]}</span></p>{question.explanation && <p>{question.explanation}</p>}{linked && (linked.note || linked.back) !== question.explanation && <p className="jp">{linked.note || linked.back}</p>}</div></article>
    })}</div>
    {user ? <Link className="btn btn-primary mastery-start" aria-keyshortcuts="Enter" to={`/study/${stageId}/${nodeId}/learn`}>Bắt đầu làm bài <ArrowRight size={16}/></Link> : <Link className="btn btn-primary mastery-start" to="/login">Đăng nhập để học</Link>}
  </div>
}
