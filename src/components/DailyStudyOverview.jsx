import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function DailyStudyOverview({ plan, weakCount }) {
  // shortcut: counts quiz and mastery introductions, extend when other study flows join the daily target.
  return <section className="daily-study-grid" aria-label="Tiến độ và ôn tập hôm nay">
    <div className="panel home-today-card"><p className="eyebrow">CÂU MỚI HÔM NAY</p><h2>{plan.newToday} / {plan.dailyLimit} câu mới</h2><div className="progress-track" role="progressbar" aria-label="Câu mới hôm nay" aria-valuemin={0} aria-valuemax={Math.max(1, plan.dailyLimit)} aria-valuenow={Math.min(plan.newToday, Math.max(1, plan.dailyLimit))}><span style={{ width: `${plan.dailyLimit ? Math.min(100, plan.newToday / plan.dailyLimit * 100) : 0}%` }} /></div><p>{plan.dailyLimit ? `${plan.newAllowance} câu mới còn trong mục tiêu hôm nay` : 'Hôm nay không có mục tiêu câu mới.'}</p></div>
    <div className="panel home-today-card"><p className="eyebrow">CẦN ÔN TẬP</p><h2>{weakCount} thẻ cần củng cố</h2><p>{plan.dueCount} câu đến hạn theo lịch ôn.</p><Link to="/review" className="text-link">Xem thẻ cần ôn <ArrowRight size={16} aria-hidden="true" /></Link></div>
  </section>
}
