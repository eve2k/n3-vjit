import QuestionText from './QuestionText.jsx'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Award, RotateCcw } from 'lucide-react'
import { useAuth } from '../context/authContext.js'
import { findLesson, lessonQuestions, nodeId } from '../utils/roadmapContent.js'
import { cardKey, createRound, LEVEL_LABELS, roundChanges, roundSummarySituation } from '../utils/masteryLearning.js'
import { getMasteryProgress, saveMasteryProgress } from '../utils/storage.js'
import useStudyShortcuts from '../hooks/useStudyShortcuts.js'

const updateId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
export default function MasterySummary() {
  const { stageId, nodeId: currentId } = useParams()
  const { user, sync, syncNow, client } = useAuth()
  const navigate = useNavigate()
  const lesson = findLesson(stageId, currentId)
  const [progress, setProgress] = useState(() => getMasteryProgress())
  const [error, setError] = useState('')
  useEffect(() => { const refresh = () => setProgress(getMasteryProgress()); window.addEventListener('n3vjit:progress', refresh); return () => window.removeEventListener('n3vjit:progress', refresh) }, [])
  const sessionKey = `${stageId}:${currentId}`
  const session = progress.nodes[sessionKey]
  const snapshot = session?.summary
  const levels = snapshot?.endLevels || Object.fromEntries((lesson?.questions || []).map(q => [cardKey(q), progress.cards[cardKey(q)]?.level ?? 0]))
  const lastNode = lesson ? lesson.index === lesson.stage.lessons.length - 1 : false
  const situation = roundSummarySituation(levels, session?.completedRounds || 0, lastNode)
  const changes = roundChanges(snapshot)
  let acknowledged = false
  try {
    const baselineKey = `${client.storageKey}:sync-base:${encodeURIComponent(user?.id || '')}`
    const baseline = JSON.parse(localStorage.getItem(baselineKey) || 'null')
    acknowledged = Boolean(user && session && sync.status === 'synced' && baseline?.n3vjit_mastery?.nodes?.[sessionKey]?.updateId === session.updateId)
  } catch { /* Sync state remains pending until the baseline is readable. */ }
  const hasResult = Boolean(lesson && session && !session.feedback && session.queue.length === 0 && session.completedRounds > 0)
  const primaryAdvances = situation.canAdvance || lastNode
  const primaryEnabled = hasResult && (!primaryAdvances || acknowledged)
  const nextTitle = lastNode ? 'Kiểm tra chặng' : lesson?.stage.lessons[lesson.index + 1]
  const startNextRound = () => {
    if (!lesson || !session || situation.mastered) return
    const keys = lesson.questions.map(cardKey)
    const oldKeys = lesson.stage.lessons.slice(0, lesson.index).flatMap((_, index) => lessonQuestions(lesson.stage, index).map(cardKey))
    const next = createRound(keys, oldKeys, progress.cards, session.round + 1, session.completedRounds, Date.now(), updateId())
    try { saveMasteryProgress({ ...progress, nodes: { ...progress.nodes, [sessionKey]: next } }); navigate(`/study/${stageId}/${currentId}/learn`) } catch (e) { setError(e.message) }
  }
  const primaryAction = () => {
    if (!primaryEnabled) return
    if (!primaryAdvances) { startNextRound(); return }
    if (lastNode) navigate(`/?checkpoint=${encodeURIComponent(stageId)}`)
    else navigate(`/study/${stageId}/${nodeId(lesson.index + 1)}`)
  }
  useStudyShortcuts({ mode: 'preview', onStart: primaryEnabled ? primaryAction : null, onExit: () => navigate('/') })
  if (!lesson) return <section className="page-shell"><p>Không tìm thấy bài học này.</p><Link to="/">Về lộ trình</Link></section>
  if (!user) return <section className="page-shell mastery-summary-page"><div className="panel mastery-summary"><h1>Chưa có kết quả được lưu</h1><p>Khách không lưu kết quả học tập. Đăng nhập để học và lưu tiến độ.</p><Link className="btn btn-primary" to="/login">Đăng nhập</Link> <Link to="/">Về lộ trình</Link></div></section>
  if (!hasResult) return <section className="page-shell mastery-summary-page"><div className="panel mastery-summary"><h1>Chưa hoàn tất vòng học</h1><p>Hãy tiếp tục bài học để xem kết quả.</p><Link className="btn btn-primary" to={`/study/${stageId}/${currentId}/learn`}>Tiếp tục học</Link> <Link to="/">Về lộ trình</Link></div></section>
  const lookup = Object.fromEntries(lesson.stage.lessons.flatMap((_, i) => lessonQuestions(lesson.stage, i)).map(question => [cardKey(question), question]))
  const wrong = (snapshot?.wrongKeys || []).map(key => lookup[key]).filter(Boolean).slice(0, 5)
  const title = lastNode ? 'Bài kiểm tra chặng đã sẵn sàng' : situation.canAdvance ? `Đã mở khóa ${nextTitle}` : 'Tiếp tục củng cố kiến thức'
  const primaryLabel = primaryAdvances ? lastNode ? 'Bắt đầu kiểm tra chặng' : `Học ${nextTitle}` : 'Bắt đầu vòng tiếp'
  return <div className="page-shell mastery-summary-page"><section className="panel mastery-summary">
    <p className="eyebrow">KẾT QUẢ VÒNG {snapshot?.round || session.round}</p><h1>{lesson.stage.title} · {lesson.stage.lessons[lesson.index]}</h1>
    {situation.mastered && <p className="summary-award"><Award size={18}/> Hoàn thành · 100% thành thạo</p>}
    <h2>{title}</h2>
    {situation.maxRounds && !situation.threshold && <p>Đã đủ 3 vòng. Các thẻ yếu sẽ được ưu tiên ôn lại ở bài sau.</p>}
    <div className="summary-level-bar" role="img" aria-label={LEVEL_LABELS.map((label, index) => `${label}: ${situation.counts[index]}`).join(', ')}>{situation.counts.map((count, index) => <span key={index} style={{ width: `${situation.total ? count / situation.total * 100 : 0}%`, background: `var(--mastery-${index})` }}/>)}</div>
    <div className="summary-level-legend">{situation.counts.map((count, index) => <span key={index}><i style={{ background: `var(--mastery-${index})` }}/>{LEVEL_LABELS[index]}: {count}</span>)}</div>
    <p>{changes ? `${changes.up} thẻ lên bậc · ${changes.down} thẻ bị lùi` : 'Vòng cũ chưa lưu ảnh chụp đầu vòng nên không thể tính số thẻ lên hoặc lùi.'}</p>
    <p>{situation.mastered ? 'Tất cả thẻ đã thành thạo.' : `Cần ít nhất ${situation.minimumRounds} vòng nữa để tất cả thẻ thành thạo nếu trả lời đúng.`}</p>
    <div className="summary-attention"><h3>Cần chú ý</h3>{!snapshot ? <p>Vòng cũ không có danh sách câu sai.</p> : wrong.length ? <ul>{wrong.map(question => <li className="jp" key={cardKey(question)}><QuestionText text={question.questionText} /></li>)}</ul> : <p>Không có thẻ trả lời sai trong vòng này.</p>}</div>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {primaryAdvances && !acknowledged && <p className="summary-sync" role="status">{['offline', 'error'].includes(sync.status) ? 'Chưa đồng bộ được kết quả. Kiểm tra kết nối rồi thử lại.' : 'Đang lưu và đồng bộ kết quả trước khi chuyển bài.'} <button type="button" className="text-link" onClick={() => syncNow()}>Thử đồng bộ</button></p>}
    <div className="summary-actions"><button className="btn btn-primary" type="button" disabled={!primaryEnabled} aria-keyshortcuts="Enter" onClick={primaryAction}>{primaryLabel} <ArrowRight size={16}/></button>{primaryAdvances && !situation.mastered && <button className="btn btn-secondary" type="button" onClick={startNextRound}><RotateCcw size={16}/> Ôn thêm vòng {session.round + 1}</button>}<Link className="text-link" to="/" aria-keyshortcuts="Escape">Về lộ trình</Link></div>
  </section></div>
}
