import { questionInstruction } from '../utils/questionMarkup.js'
import QuestionText from './QuestionText.jsx'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Check, ClipboardCheck, Send, Trophy } from 'lucide-react'
import { stages, stageQuestions, lessonQuestions, nodesFor, masteryStage, nodeId, stageProgress, continueLessonIndex, weakMasteryCount, cardLevelCounts } from '../utils/roadmapContent.js'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getCompletedQuestions, getMasteryProgress, getStudyRoadmap, markQuestionCompleted, addWrongQuestion, markWrongQuestionCorrect } from '../utils/storage.js'
import { cardKey, nodeStatus, LEVEL_LABELS } from '../utils/masteryLearning.js'
import { useAuth } from '../context/authContext.js'
import { studyDay } from '../utils/spacedRepetition.js'
import { daysBetween, DEFAULT_EXAM_DATE, formatStudyDay } from '../utils/studyRoadmap.js'


export default function StudyRoadmap() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const checkpointStage = new URLSearchParams(location.search).get('checkpoint')
  const checkpointIndex = stages.findIndex(item => item.id === checkpointStage && !item.last)
  const [now] = useState(Date.now)
  const examDate = getStudyRoadmap()?.examDate || DEFAULT_EXAM_DATE
  const daysLeft = daysBetween(studyDay(now), examDate)
  const countdown = daysLeft < 0 ? 'Ngày thi đã qua' : daysLeft === 0 ? 'Thi hôm nay' : `Còn ${daysLeft} ngày`
  const [selected, setSelected] = useState(() => Math.max(0, checkpointIndex))
  const [selectedNode, setSelectedNode] = useState(() => checkpointIndex >= 0 ? stages[checkpointIndex].lessons.length : 0)
  const [session, setSession] = useState(() => checkpointIndex >= 0 ? { stage: stages[checkpointIndex], lessonIndex: 0, checkpoint: true, questions: stageQuestions(stages[checkpointIndex]) } : null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [notice, setNotice] = useState('')
  const completed = getCompletedQuestions()
  const mastery = getMasteryProgress()
  const current = session?.questions[index]
  const answersCount = Object.keys(answers).length
  const stage = stages[selected]
  const nodes = nodesFor(stage)
  const picked = nodes[selectedNode] || nodes[0]
  const completedIds = completed
  const checkpointQuestions = stageQuestions(stage)
  const selectedQuestions = picked.kind === 'lesson' ? lessonQuestions(stage, picked.index) : checkpointQuestions
  const selectedMastery = picked.kind === 'lesson' && masteryStage(stage) ? nodeStatus(selectedQuestions.map(cardKey), mastery.cards, mastery.nodes[`${stage.id}:${nodeId(picked.index)}`]?.completedRounds || 0) : null
  const summary = stageProgress(stage, completedIds, mastery)
  const weakCount = weakMasteryCount(mastery)
  const continueIndex = continueLessonIndex(stage, completedIds, mastery)
  const selectedSession = picked.kind === 'lesson' ? mastery.nodes[`${stage.id}:${nodeId(picked.index)}`] : null
  const selectedLevels = selectedMastery ? cardLevelCounts(selectedQuestions, mastery.cards) : null
  const selectedStarted = Boolean(selectedSession || (selectedLevels && selectedLevels.unseen < selectedLevels.total))
  const selectedFinished = selectedMastery ? selectedMastery.passed : selectedQuestions.length > 0 && selectedDonePlaceholder(selectedQuestions, completedIds) === selectedQuestions.length
  const selectedButton = !selectedStarted && selectedDonePlaceholder(selectedQuestions, completedIds) === 0 ? 'Bắt đầu học' : selectedFinished ? 'Ôn lại' : 'Ôn tiếp'
  const selectedDone = picked.kind === 'lesson' ? selectedQuestions.filter(q => (completedIds[q.section] || []).includes(q.id)).length : 0

  const start = (targetStage, lessonIndex, checkpoint = false) => {
    const pool = checkpoint ? stageQuestions(targetStage) : lessonQuestions(targetStage, lessonIndex)
    if (!pool.length) return
    setSession({ stage: targetStage, lessonIndex, checkpoint, questions: pool })
    setSelectedNode(selectedNode)
    setIndex(0); setAnswers({}); setResult(null); setNotice('')
  }
  const submit = () => {
    const score = session.questions.reduce((sum, q) => sum + (String(answers[q.id]) === String(q.correctAnswer) ? 1 : 0), 0)
    try {
      if (user) session.questions.forEach(q => {
        if (!answers[q.id]) return
        markQuestionCompleted(q.section, q.id)
        const outcome = { source: session.checkpoint ? 'checkpoint' : 'practice' }
        if (String(answers[q.id]) === String(q.correctAnswer)) markWrongQuestionCorrect(q.section, q.id, outcome)
        else addWrongQuestion(q.section, q.id, outcome)
      })
      setResult({ score, total: session.questions.length }); setNotice('')
    } catch (error) { setNotice(error.message) }
  }
  const close = () => { if (checkpointStage) navigate('/', { replace: true }); setSession(null); setResult(null); setAnswers({}); setSelectedNode(0) }
  const selectStage = i => { setSelected(i); setSelectedNode(0) }

  if (session) return <div className="page-shell roadmap-page"><button className="text-link mb-5" type="button" onClick={close}><ArrowLeft size={16}/> Trở về lộ trình</button>
    <div className="page-heading"><div><p className="eyebrow">{session.checkpoint ? 'KIỂM TRA CHẶNG' : 'BÀI HỌC'} · {session.stage.title}</p><h1>{session.checkpoint ? `Kiểm tra chặng ${session.stage.title}` : `${session.stage.title} · ${session.stage.lessons[session.lessonIndex]}`}</h1><p className="page-description">{result ? 'Kết quả bài làm' : `Câu ${index + 1}/${session.questions.length} · Kết quả chỉ hiện sau khi nộp bài.`}</p></div></div>
    {notice && <div className="notice notice-error" role="alert">{notice}</div>}
    {!result && current && <section className="panel roadmap-quiz"><div className="question-meta"><span>{current.contextTitle || 'Câu hỏi'} · {index + 1}/{session.questions.length}</span></div>{current.passageText && <details className="question-context" open><summary>Đoạn văn</summary><p className="jp whitespace-pre-wrap">{current.passageText}</p></details>}<p className="question-instruction">{questionInstruction(current)}</p><h2 className="jp question-text"><QuestionText text={current.questionText} /></h2><div className="answer-list">{Object.entries(current.options || {}).map(([letter, text]) => <button type="button" className={`answer-option ${answers[current.id] === letter ? 'is-selected' : ''}`} aria-pressed={answers[current.id] === letter} key={letter} onClick={() => setAnswers(prev => ({ ...prev, [current.id]: letter }))}><span className="answer-letter">{letter}</span><span className="jp flex-1">{text}</span></button>)}</div><div className="quiz-navigation"><button type="button" className="btn btn-secondary" disabled={!index} onClick={() => setIndex(i => i - 1)}><ArrowLeft size={16}/> Câu trước</button><span>{answersCount}/{session.questions.length} đã chọn</span>{index < session.questions.length - 1 ? <button type="button" className="btn btn-primary" onClick={() => setIndex(i => i + 1)}>Câu tiếp <ArrowRight size={16}/></button> : <button type="button" className="btn btn-primary" onClick={submit}><Send size={16}/> Nộp bài</button>}</div>{index < session.questions.length - 1 && <button type="button" className="btn btn-secondary mt-3" onClick={submit}><Send size={16}/> Nộp bài ngay</button>}</section>}
    {result && <section className="panel roadmap-result"><span className="feature-icon"><ClipboardCheck size={23}/></span><p className="eyebrow">ĐÃ NỘP BÀI</p><h2>{result.score}/{result.total} câu đúng</h2><p>{Math.round(result.score / result.total * 100)}% · {result.score / result.total >= .8 ? 'Đạt mục tiêu chặng' : 'Hãy ôn lại các bài trong chặng rồi thử lại.'}</p><div className="roadmap-result-list">{session.questions.map((q, i) => <div key={q.id} className={String(answers[q.id]) === String(q.correctAnswer) ? 'result-correct' : 'result-wrong'}><strong>{i + 1}. {String(answers[q.id]) === String(q.correctAnswer) ? 'Đúng' : `Sai · Đáp án ${q.correctAnswer || 'chưa có'}`}</strong><span>{q.explanation || q.keyTakeaway || ''}</span></div>)}</div><button className="btn btn-primary mt-5" onClick={close}>Về lộ trình</button></section>}
  </div>

  const nodeX = i => 340 + 140 * Math.sin(i * 1.1)
  const nodeY = i => 52 + i * 61
  const selectedIndex = nodes.findIndex(node => node.kind === 'lesson' && lessonQuestions(stage, node.index).some(q => !(completedIds[q.section] || []).includes(q.id)))
  const continueStudy = () => {
    if (stage.last) { navigate('/exam'); return }
    const lessonIndex = continueIndex
    if (masteryStage(stage)) { navigate(`/study/${stage.id}/${nodeId(lessonIndex)}`); return }
    start(stage, lessonIndex)
  }
  const nodeAction = () => {
    if (picked.kind === 'lesson' && stage.id === 'exam') { window.location.assign('/exam'); return }
    if (picked.kind === 'lesson' && masteryStage(stage)) { navigate(`/study/${stage.id}/${nodeId(picked.index)}`); return }
    if (picked.kind === 'lesson') { start(stage, picked.index); return }
    if (picked.kind === 'checkpoint' && checkpointQuestions.length) { start(stage, 0, true); return }
    if (picked.kind === 'end' && selected < stages.length - 1) selectStage(selected + 1)
  }

  return <div className="page-shell roadmap-page roadmap-overview">
    <header className="roadmap-compact-head"><span className="roadmap-eyebrow">HUTECH · CHỨNG CHỈ TIẾNG NHẬT VJIT</span><h1>Lộ trình N3</h1><div className="roadmap-countdown"><CalendarDays size={16} aria-hidden="true"/><strong>{countdown}</strong><span>· {formatStudyDay(examDate)}</span></div><p>Chọn chặng và node muốn học. Bài kiểm tra chặng tổng hợp câu hỏi của toàn bộ node nhỏ trong chặng.</p></header>
    <nav className="roadmap-tabs" aria-label="Các chặng">{stages.map((item, i) => <button key={item.id} type="button" className={selected === i ? 'active' : ''} aria-pressed={selected === i} onClick={() => selectStage(i)}><b>{item.title}</b><small>{item.id === 'exam' ? '3 đề thi' : `${completedLessonCount(item, completedIds, mastery)}/${item.lessons.length} bài`}</small></button>)}</nav>
    <div className="roadmap-layout">
    <aside className="roadmap-left-column panel" aria-label="Tổng quan chặng"><p className="eyebrow">TIẾN ĐỘ CHẶNG</p><h2>Chặng {stage.title}</h2>{stage.last ? <p>{stage.lessons.length} đề thi thử</p> : <><p>{summary.passed}/{summary.lessons} bài đã qua</p>{masteryStage(stage) ? <><div className="stage-level-bar" role="img" aria-label={[`Chưa học: ${summary.unseen}`, ...LEVEL_LABELS.map((label, index) => `${label}: ${summary.counts[index]}`)].join(', ')}>{summary.counts.map((count, index) => <span key={index} style={{ width: `${summary.total ? count / summary.total * 100 : 0}%`, background: `var(--mastery-${index})` }}/>)}</div><div className="stage-level-legend"><span><i className="unseen-dot"/>Chưa học: {summary.unseen}</span>{summary.counts.map((count, index) => <span key={index}><i style={{ background: `var(--mastery-${index})` }}/>{LEVEL_LABELS[index]}: {count}</span>)}</div></> : <div className="stage-level-bar" role="progressbar" aria-valuemin={0} aria-valuemax={summary.lessons} aria-valuenow={summary.passed} aria-label="Bài đã qua"><span style={{ width: `${summary.lessons ? summary.passed / summary.lessons * 100 : 0}%`, background: 'var(--accent)' }}/></div>}</>}<button type="button" className="btn btn-primary roadmap-continue" onClick={continueStudy}>{stage.last ? 'Tiếp tục: Thi thử' : `Tiếp tục: ${stage.lessons[continueIndex]}`}</button></aside>
    <div className="roadmap-map-scroll"><svg className="roadmap-map" viewBox={`130 0 420 ${nodeY(nodes.length - 1) + 60}`} role="img" aria-label={`Con đường chặng ${stage.title}`}>
      {nodes.slice(0, -1).map((node, i) => { const done = node.kind === 'lesson' && lessonQuestions(stage, node.index).length > 0 && lessonQuestions(stage, node.index).every(q => (completedIds[q.section] || []).includes(q.id)); const x1 = nodeX(i), y1 = nodeY(i), x2 = nodeX(i + 1), y2 = nodeY(i + 1); return <path key={`path-${i}`} d={trimmedPath(x1, y1, x2, y2, 31, 31)} className={`map-path${done ? ' is-done' : ''}`} /> })}
      {nodes.map((node, i) => { const x = nodeX(i), y = nodeY(i), active = i === selectedNode, qs = node.kind === 'lesson' ? lessonQuestions(stage, node.index) : [], doneCount = qs.filter(q => (completedIds[q.section] || []).includes(q.id)).length, levelDistribution = node.kind === 'lesson' && masteryStage(stage) ? cardLevelCounts(qs, mastery.cards) : null, masteryStatus = node.kind === 'lesson' && masteryStage(stage) ? nodeStatus(qs.map(cardKey), mastery.cards, mastery.nodes[`${stage.id}:${nodeId(node.index)}`]?.completedRounds || 0) : null, isDone = masteryStatus ? masteryStatus.mastered : qs.length > 0 && doneCount === qs.length, isCurrent = selectedIndex === i, labelLeft = x >= 340, labelX = x + (labelLeft ? -42 : 42), anchor = labelLeft ? 'end' : 'start'; const click = () => { setSelectedNode(i); if (stage.id === 'exam' && node.kind === 'lesson') window.location.assign('/exam') }; return <g key={`${stage.id}-${node.kind}-${i}`} className="map-node-group" style={{ '--node-index': i }} role="button" tabIndex="0" aria-label={node.title} aria-pressed={active} onClick={click} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); click() } }}>
        {node.kind === 'checkpoint' ? <><rect x={x-25} y={y-25} width="50" height="50" rx="10" className={`map-checkpoint${active ? ' selected' : ''}`} /><text x={x} y={y+7} textAnchor="middle" className="map-checkpoint-mark">合</text></> : node.kind === 'end' ? <><circle cx={x} cy={y} r="22" className={`map-end${active ? ' selected' : ''}`} />{selected < stages.length-1 ? <path d={`M${x-5} ${y-7}l8 7-8 7`} className="map-lock"/> : <Trophy x={x-9} y={y-9} width="18" height="18" className="map-lock"/>}</> : <><circle cx={x} cy={y} r="22" className={`map-lesson-node${isDone ? ' done' : ''}${active || isCurrent ? ' current' : ''}`} />{isDone ? <Check x={x-9} y={y-9} width="18" height="18" className="map-done-check"/> : <text x={x} y={y+5} textAnchor="middle" className="map-node-number">{i+1}</text>}{levelDistribution && levelDistribution.unseen < levelDistribution.total && <g transform={`rotate(-90 ${x} ${y})`}><circle cx={x} cy={y} r="32" fill="none" stroke="var(--line)" strokeWidth="2.5"/>{levelDistribution.counts.map((n, level) => { const r = 32, circumference = 2 * Math.PI * r, offset = levelDistribution.counts.slice(0, level).reduce((a, b) => a + b, 0); return n ? <circle key={level} cx={x} cy={y} r={r} fill="none" stroke={`var(--mastery-${level})`} strokeWidth="2.5" strokeDasharray={`${circumference * n / levelDistribution.total} ${circumference}`} strokeDashoffset={-circumference * offset / levelDistribution.total}/> : null })}</g>}</>}
        <text x={labelX} y={y-3} textAnchor={anchor} className="map-node-title">{node.title}</text><text x={labelX} y={y+14} textAnchor={anchor} className="map-node-subtitle">{node.kind === 'lesson' ? isDone ? 'Thành thạo' : masteryStatus?.passed ? 'Đã qua' : `${lessonQuestions(stage, node.index).length} câu` : node.kind === 'checkpoint' ? `${checkpointQuestions.length} câu · kiểm tra ngay` : selected < stages.length-1 ? 'Sang chặng tiếp' : 'Chúc bạn thi tốt'}</text>
      </g> })}
    </svg></div>
    <div className="roadmap-right-column"><aside className="roadmap-selected-panel" aria-live="polite">
      <h2>{picked.kind === 'lesson' ? `${stage.title} · ${picked.title}` : picked.title}</h2>
      {picked.kind === 'lesson' ? <>{selectedLevels && <div className="roadmap-levels"><span><i className="unseen-dot"/>Chưa học: {selectedLevels.unseen}</span>{selectedLevels.counts.map((count, level) => <span key={level}><i style={{ background: `var(--mastery-${level})` }}/>{LEVEL_LABELS[level]}: {count}</span>)}</div>}<p>{stage.id === 'exam' ? 'Mở đề thi thử tổng hợp.' : selectedMastery ? `${selectedMastery.total} thẻ · ${selectedMastery.mastered ? 'Thành thạo hoàn toàn' : selectedMastery.passed ? 'Đã qua node' : selectedStarted ? 'Đang học' : 'Chưa học'}.` : `${selectedQuestions.length} câu · ${selectedDone} câu đã làm.`}</p>{selectedSession && !selectedFinished && <p className="roadmap-round">Đang học vòng {selectedSession.round}</p>}<button type="button" className="btn" onClick={nodeAction}>{stage.id === 'exam' ? 'Bắt đầu thi thử' : selectedButton}</button></> : picked.kind === 'checkpoint' ? <><p>Bài kiểm tra gồm {checkpointQuestions.length} câu từ tất cả node nhỏ trong chặng. Bạn có thể bắt đầu ngay; đáp án và điểm chỉ hiện sau khi nộp.</p><button type="button" className="btn seal" onClick={nodeAction}>Bắt đầu kiểm tra chặng</button></> : <><p>{selected < stages.length-1 ? `Bạn có thể chuyển sang ${stages[selected+1].title} bất cứ lúc nào.` : 'Hoàn tất lộ trình và luyện đề trước ngày thi.'}</p>{selected < stages.length-1 && <button type="button" className="btn" onClick={nodeAction}>Sang chặng {stages[selected+1].title}</button>}</>}
    </aside><section className="roadmap-weak-card panel"><p className="eyebrow">ÔN TẬP</p><h2>Cần củng cố</h2>{!user ? <><p>Đăng nhập để xem những thẻ cần ôn của bạn.</p><Link className="text-link" to="/login">Đăng nhập <ArrowRight size={15}/></Link></> : weakCount > 0 ? <><p><strong>{weakCount} thẻ</strong> cần củng cố hoặc kiểm tra lại.</p><Link className="text-link" to="/review">Xem thẻ cần củng cố <ArrowRight size={15}/></Link></> : <><p>Hãy bắt đầu bài đầu tiên để xây dựng tiến độ học.</p><Link className="text-link" to="/review">Xem thẻ cần củng cố <ArrowRight size={15}/></Link></>}</section></div>
    </div>
    <section className="roadmap-separate" hidden><p className="eyebrow">KHU VỰC RIÊNG</p><div><a href="/choukai" className="btn ghost">Nghe · chưa có file âm thanh</a><a href="/sakubun" className="btn ghost">Viết · tự luyện</a></div></section>
  </div>
}

function completedLessonCount(stage, completed, mastery) { return stage.lessons.filter((_, index) => { const questions = lessonQuestions(stage, index); return masteryStage(stage) ? nodeStatus(questions.map(cardKey), mastery.cards, mastery.nodes[`${stage.id}:${nodeId(index)}`]?.completedRounds || 0).passed : questions.length > 0 && questions.every(question => (completed[question.section] || []).includes(question.id)) }).length }

function selectedDonePlaceholder(questions, completed) { return questions.filter(q => (completed[q.section] || []).includes(q.id)).length }

// Approximate the cubic route and trim its ends so dots stop outside node edges.
function trimmedPath(x1, y1, x2, y2, startGap, endGap) {
  const middle = (y1 + y2) / 2
  const points = Array.from({ length: 61 }, (_, index) => {
    const t = index / 60, u = 1 - t
    return { x: u*u*u*x1 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x2, y: u*u*u*y1 + 3*u*u*t*middle + 3*u*t*t*middle + t*t*t*y2 }
  })
  const distances = [0]
  for (let i = 1; i < points.length; i++) distances.push(distances[i-1] + Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y))
  const total = distances.at(-1), end = Math.max(startGap, total - endGap)
  if (end <= startGap) return ''
  const at = distance => { const index = Math.max(1, distances.findIndex(d => d >= distance)); const fraction = (distance - distances[index-1]) / (distances[index] - distances[index-1] || 1); return { x: points[index-1].x + fraction * (points[index].x - points[index-1].x), y: points[index-1].y + fraction * (points[index].y - points[index-1].y) } }
  const slice = [at(startGap), ...points.filter((_, index) => distances[index] > startGap && distances[index] < end), at(end)]
  return slice.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
}
