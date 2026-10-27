import { Link, useSearchParams, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, Layers3 } from 'lucide-react'
import { useAuth } from '../context/authContext.js'
import useReviewProgress from '../hooks/useReviewProgress.js'
import { stages, weakMasteryNodes, weakMasteryCount, nodeId, masteryStage } from '../utils/roadmapContent.js'
import { cardKey, LEVEL_LABELS, needsRecheck } from '../utils/masteryLearning.js'
import { reviewCatalog, eligibleReviewCards, correctAnswerText } from '../utils/reviewLearning.js'
import QuestionText from './QuestionText.jsx'
import ReviewSetup from './ReviewSetup.jsx'

export default function ReviewPage() {
  const { user } = useAuth()
  const { mastery, review } = useReviewProgress()
  const [params] = useSearchParams()
  const location = useLocation()
  const masteredTab = params.get('tab') === 'mastered'
  const stage = stages.find(stage => stage.id === params.get('stage') && !stage.last)
  return <div className="page-shell review-page">
    <header className="page-heading"><div><p className="eyebrow">GIỮ VỮNG KIẾN THỨC</p><h1>Ôn tập</h1><p className="page-description">Củng cố thẻ còn yếu và kiểm tra lại những kiến thức bạn đã nhớ.</p></div></header>
    <nav className="review-tabs" aria-label="Nội dung ôn tập">
      <Link to="/review" aria-current={!masteredTab ? 'page' : undefined} className={!masteredTab ? 'active' : ''}>Cần củng cố <span>{weakMasteryCount(mastery)}</span></Link>
      <Link to="/review?tab=mastered" aria-current={masteredTab ? 'page' : undefined} className={masteredTab ? 'active' : ''}>Đã thành thạo</Link>
    </nav>
    {user && review.session?.data && params.get('setup') !== '1' && <section className="panel review-resume"><div><h2>Bài kiểm tra đang làm</h2><p>{stages.find(s => s.id === review.session.data.stageId)?.title} · {Object.keys(review.session.data.answers).length}/{review.session.data.items.length} câu đã trả lời</p></div><Link className="btn btn-primary" to="/review/test">Tiếp tục kiểm tra <ArrowRight size={16}/></Link></section>}
    {!user ? <section className="panel weak-empty"><BookOpen size={28}/><h2>Đăng nhập để ôn tập</h2><p>Xem thẻ cần củng cố và lưu kết quả kiểm tra theo tài khoản của bạn.</p><Link className="btn btn-primary" to="/login">Đăng nhập</Link></section>
      : !masteredTab ? <Consolidation mastery={mastery} />
      : stage && params.get('setup') === '1' ? <ReviewSetup key={`${stage.id}:${location.key}`} stage={stage} mastery={mastery} review={review} retryKeys={Array.isArray(location.state?.retryKeys) ? location.state.retryKeys.filter(key => typeof key === 'string') : null}/>
      : stage ? <StageCards stage={stage} mastery={mastery} results={review.results} />
      : <div className="review-stage-grid">{stages.filter(stage => !stage.last).map(stage => {
        const total = reviewCatalog(stage.id).length
        const eligible = eligibleReviewCards(stage.id, mastery, review.results).length
        return <Link key={stage.id} className="panel review-stage-card" to={`/review?tab=mastered&stage=${stage.id}`}>
          <span className="review-stage-icon"><Layers3 size={22}/></span><h2>{stage.title}</h2>
          <p>{masteryStage(stage) ? 'Thẻ thành thạo' : 'Câu đã làm đúng'}</p>
          <strong>{eligible}<small> / {total}</small></strong>
          <div className="review-meter" role="progressbar" aria-label={`${stage.title}: ${masteryStage(stage) ? 'thẻ thành thạo' : 'câu đã làm đúng'}`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={eligible}><span style={{ width: `${total ? eligible / total * 100 : 0}%` }}/></div>
          <span className="review-stage-link">Xem theo bài <ArrowRight size={16}/></span>
        </Link>
      })}</div>}
    {user && masteredTab && !stage && <p className="review-note">Ngữ pháp và Đọc hiểu tính theo kết quả đúng ở lần gần nhất. Các câu từ dữ liệu cũ cần được làm lại để ghi nhận kết quả.</p>}
  </div>
}

function Consolidation({ mastery }) {
  const nodes = weakMasteryNodes(mastery)
  if (!nodes.length) return <section className="panel weak-empty"><CheckCircle2 size={28}/><h2>Chưa có thẻ cần củng cố</h2><p>Tiếp tục học trên lộ trình hoặc kiểm tra lại kiến thức đã nhớ.</p><Link className="btn btn-primary" to="/">Đến lộ trình</Link></section>
  return <><p className="review-note">Thẻ Chưa biết/Tạm và thẻ vừa sai khi kiểm tra. Thẻ có nhãn “Cần kiểm tra lại” sẽ trở về bậc Thành thạo khi bạn trả lời đúng.</p><div className="weak-node-list">{nodes.map(node => <section className="panel weak-node" key={`${node.stage.id}:${nodeId(node.index)}`}>
    <div className="weak-node-header"><div><p className="eyebrow">{node.stage.title}</p><h2>{node.title}</h2><p>{node.questions.length} thẻ cần ôn</p></div><Link className="btn btn-primary" to={`/study/${node.stage.id}/${nodeId(node.index)}`}>Ôn bài này <ArrowRight size={15}/></Link></div>
    <ul>{node.questions.map(question => { const card = mastery.cards[cardKey(question)]; return <li key={cardKey(question)}><span className="jp"><QuestionText text={question.questionText}/></span><span className={`mastery-level lv${card.level}`}>{needsRecheck(card) ? 'Cần kiểm tra lại' : LEVEL_LABELS[card.level]}</span></li> })}</ul>
  </section>)}</div></>
}

function StageCards({ stage, mastery, results }) {
  const questions = eligibleReviewCards(stage.id, mastery, results)
  const groups = new Map()
  for (const question of questions) groups.set(question.lessonId, [...(groups.get(question.lessonId) || []), question])
  return <section className="review-stage-detail">
    <Link className="text-link" to="/review?tab=mastered"><ArrowLeft size={16}/> Các chặng</Link>
    <div className="review-section-head"><div><h2>{stage.title}</h2><p>{questions.length} {masteryStage(stage) ? 'thẻ thành thạo' : 'câu đã làm đúng ở lần gần nhất'}</p></div>
      {questions.length ? <Link className="btn btn-primary" to={`/review?tab=mastered&stage=${stage.id}&setup=1`}><ClipboardCheck size={17}/> Làm kiểm tra</Link> : <button className="btn btn-primary" disabled aria-describedby="review-empty-reason">Làm kiểm tra</button>}
    </div>
    {!questions.length ? <div className="panel weak-empty"><BookOpen size={28}/><h3>Chưa có câu đủ điều kiện</h3><p id="review-empty-reason">{masteryStage(stage) ? 'Học thẻ lên bậc Thành thạo để mở bài kiểm tra.' : 'Làm đúng câu hỏi để bổ sung vào danh sách này. Tiến độ cũ không được suy đoán là đã làm đúng.'}</p><Link className="btn btn-secondary" to={stage.id === 'reading' ? '/dokkai' : '/'}>Bắt đầu học</Link></div>
      : [...groups].map(([id, cards]) => <section className="panel review-card-group" key={id}><h3>{cards[0].lessonTitle}</h3><p>{cards.length} câu</p>
        {cards[0].passageText && <details className="review-passage"><summary>Đọc đoạn văn</summary><p className="jp">{cards[0].passageText}</p></details>}
        <ul>{cards.map(question => <li key={question.key}><p className="jp"><QuestionText text={question.questionText}/></p><p className="review-card-answer"><CheckCircle2 size={16}/><span><span className="review-answer-label">Đáp án: </span><span className="jp"><QuestionText text={correctAnswerText(question)}/></span></span></p></li>)}</ul>
      </section>)}
  </section>
}
