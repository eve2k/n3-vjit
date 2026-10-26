import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { useAuth } from '../context/authContext.js'
import { getStudyRoadmap, saveStudyExamDate } from '../utils/storage.js'
import { studyDay } from '../utils/spacedRepetition.js'
import { calculateRoadmap, defaultExamDate, formatStudyDay, shiftDay } from '../utils/studyRoadmap.js'

export default function StudyRoadmap({ stats, now, compact = false, onChange = () => {} }) {
  const { user } = useAuth()
  const [draft, setDraft] = useState(null)
  const [notice, setNotice] = useState(null)
  if (!user) return null
  const today = studyDay(now)
  const plan = getStudyRoadmap() || { startDate: today, examDate: defaultExamDate(today), customExam: false, updatedAt: new Date(now).toISOString() }
  const roadmap = stats.roadmap || calculateRoadmap(plan, { today, unseenCount: stats.unseenCount, newToday: stats.newToday, dueCount: stats.dueCount })
  const nextMock = roadmap.events.find(event => event.kind === 'mock' && event.date >= today)
  const save = event => {
    event.preventDefault()
    try {
      saveStudyExamDate(draft || plan.examDate)
      setDraft(null); setNotice({ text: 'Đã cập nhật ngày thi và tính lại lộ trình.', error: false }); onChange()
    } catch (error) { setNotice({ text: error.message, error: true }) }
  }
  return <section className="panel srs-plan roadmap-panel" aria-label="Lộ trình tới ngày thi">
    <div className="account-section-heading"><span className="feature-icon"><CalendarClock size={23} aria-hidden="true" /></span><div><h2>Lộ trình tới ngày thi</h2><p>Bắt đầu {formatStudyDay(plan.startDate)} · Thi {formatStudyDay(plan.examDate)} · Giờ Việt Nam</p></div></div>
    <div className="srs-metrics"><div><strong>{roadmap.daysLeft}</strong><span>Ngày còn lại trước thi</span></div><div><strong>{roadmap.dailyNewTarget}</strong><span>Mục tiêu câu mới hôm nay</span></div><div><strong>{roadmap.consolidationDays}</strong><span>Ngày cuối để củng cố</span></div><div><strong>{roadmap.sessionsToday}</strong><span>Phiên ngắn còn lại hôm nay</span></div></div>
    <p>{roadmap.phase === 'learning' ? `Học kiến thức mới trước ${formatStudyDay(roadmap.consolidationStart)}, xen kẽ các câu đến hạn ôn. Số câu mỗi ngày tự tính lại theo phần chưa học và số ngày còn lại.` : roadmap.phase === 'consolidation' ? 'Đang trong giai đoạn củng cố: ưu tiên câu đến hạn, câu sai và lượt ôn cuối trước thi.' : roadmap.examPassed ? 'Ngày thi đã qua. Hãy chọn ngày thi mới để tiếp tục phân bổ kiến thức mới; lịch ôn hiện có vẫn dùng được.' : 'Hôm nay là ngày thi. Tập trung ôn các câu cần củng cố, không thêm kiến thức mới.'}</p>
    {roadmap.catchingUp && !roadmap.insufficientStudyTime && <p className="notice">Còn kiến thức chưa học trong giai đoạn cuối. Kế hoạch đã chia lại số câu mới để bù phần còn thiếu trên các ngày học còn lại.</p>}
    {roadmap.insufficientStudyTime && <p className="notice">Không còn ngày để phân bổ kiến thức mới sau khi dành thời gian thi thử và chữa đề. Hãy ưu tiên phần còn yếu; lịch hiện tại không thể phủ hết phần chưa học trước thi.</p>}
    {roadmap.todayEvent && <div className="notice roadmap-event"><strong>{roadmap.todayEvent.kind === 'mock' ? `Hôm nay: Thi thử ${roadmap.todayEvent.number}${roadmap.todayEvent.combined ? ' và chữa đề' : ''}` : `Hôm nay: Chữa đề thi thử ${roadmap.todayEvent.number}`}</strong><p>Không giao câu mới. Ưu tiên {roadmap.todayEvent.kind === 'mock' ? 'làm trọn một đề và xem kết quả' : 'xem lại đáp án, phân tích câu sai và phần còn yếu'}; nếu còn thời gian có thể ôn nhanh tối đa 10 câu trong một phiên.</p><Link className="btn btn-primary mt-3" to={roadmap.todayEvent.kind === 'mock' ? '/exam' : '/exam?review=latest'}>{roadmap.todayEvent.kind === 'mock' ? 'Vào thi thử' : 'Mở đề gần nhất để chữa'}</Link></div>}
    {!roadmap.todayEvent && nextMock && <p>Thi thử tiếp theo: <strong>{formatStudyDay(nextMock.date)}</strong>. Lịch đã chừa ngày làm đề và chữa đề, không giao câu mới vào các ngày đó.</p>}
    {roadmap.dailyNewTarget > 30 && <p className="notice">Khối lượng hôm nay khá lớn: {roadmap.dailyNewTarget} câu mới, cộng các câu ôn. Hãy chia thành nhiều phiên và chọn ngày thi phù hợp với thời gian học của bạn.</p>}
    {compact ? <Link to="/quiz" className="text-link mt-4">Xem lịch và đổi ngày thi</Link> : <form className="roadmap-date-form" onSubmit={save}><label htmlFor="study-exam-date">Ngày thi của bạn<input id="study-exam-date" type="date" min={shiftDay(today, 1)} required value={draft ?? plan.examDate} onChange={event => setDraft(event.target.value)} /></label><button type="submit" className="btn btn-secondary">Cập nhật lộ trình</button></form>}
    {notice && <p className={`notice ${notice.error ? 'notice-error' : 'notice-success'} mt-4`} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {!compact && <div className="roadmap-exam-dates"><h3>Ngày dành cho thi thử và chữa đề</h3>{roadmap.events.map(event => <p key={`${event.kind}-${event.date}`}><strong>{formatStudyDay(event.date)}</strong> · {event.kind === 'mock' ? `Thi thử ${event.number}${event.combined ? ' + chữa đề' : ''}` : `Chữa đề ${event.number}`}</p>)}<p className="auth-field-hint">Nếu chỉ còn rất ít ngày, thi thử và chữa đề được gộp cùng một ngày. Kế hoạch không giả định bạn đã hoàn thành đề; hãy vào lịch sử thi để xem bài thực tế.</p></div>}
    {!compact && stats.forecast?.length > 0 && <div className="roadmap-forecast"><h3>Dự kiến 7 ngày tới</h3><div className="roadmap-table-scroll"><table><thead><tr><th>Ngày</th><th>Câu mới dự kiến</th><th>Câu ôn đã hẹn</th><th>Giai đoạn</th></tr></thead><tbody>{stats.forecast.map(day => <tr key={day.date}><td>{day.date === today ? 'Hôm nay' : formatStudyDay(day.date)}</td><td>{day.newCount}</td><td>{day.reviewCount}</td><td>{day.event ? day.event.kind === 'mock' ? 'Thi thử' : 'Chữa đề' : day.phase === 'learning' ? 'Học + ôn' : day.phase === 'consolidation' ? 'Củng cố' : 'Ngày thi'}</td></tr>)}</tbody></table></div><p className="auth-field-hint">Dự kiến khi hoàn thành phần được chia mỗi ngày. Cột ôn chỉ tính các câu đã có lịch; câu mới và câu trả lời sai sẽ bổ sung lịch sau mỗi lượt học.</p></div>}
    {!compact && <p className="auth-field-hint">Kế hoạch hướng tới phủ đủ ngân hàng câu hỏi trước thi. Khả năng ghi nhớ còn phụ thuộc kết quả ôn và thời gian học thực tế.</p>}
  </section>
}
