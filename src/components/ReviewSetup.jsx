import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ClipboardCheck } from 'lucide-react'
import { eligibleReviewCards, reviewCatalog, supportsWritten } from '../utils/reviewLearning.js'
import { startReviewTest, cancelReviewTest } from '../utils/storage.js'

export default function ReviewSetup({ stage, mastery, review, retryKeys = null }) {
  const navigate = useNavigate()
  const [scope, setScope] = useState('all')
  const [lessons, setLessons] = useState([])
  const [quantity, setQuantity] = useState(null)
  const [mode, setMode] = useState('multiple-choice')
  const [prioritizeOld, setPrioritizeOld] = useState(false)
  const [error, setError] = useState('')
  const lessonIds = scope === 'all' ? null : lessons
  const eligible = eligibleReviewCards(stage.id, mastery, review.results, { lessonIds, retryKeys })
  const allEligible = eligibleReviewCards(stage.id, mastery, review.results, { retryKeys })
  const groups = new Map(reviewCatalog(stage.id).map(q => [q.lessonId, q.lessonTitle]))
  const count = quantity === null ? Math.min(10, eligible.length) : quantity === '' ? NaN : Number(quantity)
  const validCount = Number.isInteger(count) && count > 0 && count <= eligible.length
  const busy = Boolean(review.session?.data)
  const start = event => {
    event.preventDefault()
    if (!validCount || busy) return
    try {
      startReviewTest({ stageId: stage.id, mode, count, lessonIds, prioritizeOld, retryKeys })
      navigate('/review/test')
    } catch (failure) { setError(failure.message) }
  }
  const cancel = () => {
    if (!window.confirm('Hủy bài kiểm tra đang làm? Các câu trong phiên này chưa được chốt vào tiến độ.')) return
    try { cancelReviewTest(review.session.id); setError('') } catch (failure) { setError(failure.message) }
  }
  return <section className="review-setup">
    <Link className="text-link" to={`/review?tab=mastered&stage=${stage.id}`}><ArrowLeft size={16}/> Danh sách thẻ</Link>
    <header className="review-section-head"><div><p className="eyebrow">{stage.title}</p><h2>{retryKeys ? 'Ôn lại các thẻ sai' : 'Thiết lập bài kiểm tra'}</h2><p>Chọn phạm vi và cách bạn muốn kiểm tra trí nhớ.</p></div><ClipboardCheck size={28} aria-hidden="true"/></header>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {busy && <section className="panel review-resume"><div><h3>Bạn có bài kiểm tra chưa hoàn thành</h3><p>Tiếp tục hoặc hủy phiên đó trước khi tạo đề mới.</p></div><div className="review-actions"><Link className="btn btn-primary" to="/review/test">Tiếp tục kiểm tra</Link><button className="btn btn-secondary" onClick={cancel}>Hủy phiên cũ</button></div></section>}
    <form className="panel review-settings" onSubmit={start}>
      <fieldset><legend>Phạm vi</legend><div className="review-choice-row"><label><input type="radio" name="scope" checked={scope === 'all'} onChange={() => { setScope('all'); setQuantity(null) }}/> Cả chặng</label><label><input type="radio" name="scope" checked={scope === 'lessons'} onChange={() => { setScope('lessons'); setQuantity(null) }}/> Chọn bài</label></div>
        {scope === 'lessons' && <div className="review-lesson-picker">{[...groups].map(([id, title]) => {
          const total = allEligible.filter(q => q.lessonId === id).length
          return <label key={id}><input type="checkbox" checked={lessons.includes(id)} disabled={!total} onChange={event => { setLessons(value => event.target.checked ? [...value, id] : value.filter(key => key !== id)); setQuantity(null) }}/><span>{title}</span><small>{total} câu</small></label>
        })}</div>}
      </fieldset>
      <fieldset><legend>Số câu</legend><label className="review-number-label" htmlFor="review-count">Có {eligible.length} câu đủ điều kiện trong phạm vi</label><input id="review-count" type="number" min="1" max={eligible.length || 1} step="1" value={quantity === null ? count : quantity} disabled={!eligible.length} onChange={event => setQuantity(event.target.value)} aria-describedby="review-count-hint"/>
        <div className="review-quick-count">{[5, 10, 20].map(amount => <button type="button" key={amount} disabled={amount > eligible.length} aria-pressed={count === amount} onClick={() => setQuantity(String(amount))}>{amount}</button>)}<button type="button" disabled={!eligible.length} aria-pressed={count === eligible.length && count > 0} onClick={() => setQuantity(String(eligible.length))}>Tất cả</button></div>
        <p id="review-count-hint" className="review-note">{eligible.length ? validCount ? 'Mỗi câu chỉ xuất hiện một lần trong đề.' : `Nhập số nguyên từ 1 đến ${eligible.length}.` : scope === 'lessons' && !lessons.length ? 'Chọn ít nhất một bài có câu đủ điều kiện.' : retryKeys ? 'Các thẻ này đã được củng cố hoặc không còn trong danh sách cần ôn.' : 'Chưa có thẻ đủ điều kiện để kiểm tra. Hãy học thêm rồi quay lại.'}</p>
      </fieldset>
      <fieldset><legend>Chế độ</legend><div className="review-mode-picker">
        <label><input type="radio" name="mode" checked={mode === 'multiple-choice'} onChange={() => setMode('multiple-choice')}/><span><strong>Trắc nghiệm</strong><small>Chọn đáp án trong các lựa chọn được xáo.</small></span></label>
        <label><input type="radio" name="mode" checked={mode === 'true-false'} onChange={() => setMode('true-false')}/><span><strong>Đúng/Sai</strong><small>Đánh giá đáp án ghép với câu hỏi.</small></span></label>
        <label><input type="radio" name="mode" checked={mode === 'written'} disabled={!supportsWritten(stage.id)} onChange={() => setMode('written')}/><span><strong>Tự luận</strong><small>{supportsWritten(stage.id) ? 'Gõ đáp án, có thể tự xác nhận sau khi nộp câu.' : 'Chỉ dành cho Kanji, Từ vựng và Chia thể.'}</small></span></label>
      </div></fieldset>
      <label className="review-priority"><input type="checkbox" checked={prioritizeOld} onChange={event => setPrioritizeOld(event.target.checked)}/> Ưu tiên thẻ lâu chưa kiểm tra</label>
      <div className="review-setup-footer"><p>{supportsWritten(stage.id) ? 'Kết quả được chốt khi hoàn thành bài kiểm tra. Trả lời sai sẽ lùi một bậc.' : 'Kết quả sẽ cập nhật trạng thái đúng/sai gần nhất của từng câu.'}</p><button type="submit" className="btn btn-primary" disabled={!validCount || busy} aria-describedby={!validCount ? 'review-count-hint' : undefined}>Bắt đầu <ArrowRight size={17}/></button></div>
    </form>
  </section>
}
