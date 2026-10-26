import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BookOpen, CheckCircle2, ClipboardList, Download, Headphones, History, Layers, MessageCircle, PenLine, RotateCcw, ShieldCheck, Sparkles, Target, Trophy, Upload } from 'lucide-react'
import { allQuizQuestions, quizSections, QUIZ_TOTAL, dokkai, kaiwaSakubun, flashcardDecks } from '../data/index.js'
import { exportProgress, getCompletedQuestions, getCustomSakubun, getDokkaiProgress, getSpacedRepetition, getStudyRoadmap, getMasteredFlashcards, getQuizHistory, getWrongQuestions, importProgress, resetAllProgress } from '../utils/storage.js'
import { formatDuration, getMistakeQuestions, getQuizProgress, getSectionProgress } from '../utils/learning.js'
import { useAuth } from '../context/authContext.js'
import { buildStudyPlan, formatReviewDate } from '../utils/spacedRepetition.js'
import StudyRoadmap from './StudyRoadmap.jsx'

const sectionNames = { fukushuu1: 'Câu đồng nghĩa', renshuu2: 'Từ vựng & kết hợp từ', renshuu3: 'Kanji', renshuu4: 'Ngữ pháp', renshuu5: 'Chia thể' }
const skills = [
  { to: '/dokkai', name: 'Đọc hiểu', jp: '読解', icon: BookOpen, description: 'Đọc đoạn văn và luyện tìm ý chính.' },
  { to: '/choukai', name: 'Luyện nghe', jp: '聴解', icon: Headphones, description: 'Ôn các tình huống và lựa chọn trong đề.' },
  { to: '/kaiwa', name: 'Hội thoại', jp: '会話', icon: MessageCircle, description: 'Luyện hỏi đáp theo từng chủ đề.' },
  { to: '/sakubun', name: 'Viết bài', jp: '作文', icon: PenLine, description: 'Tự viết và đối chiếu với bài mẫu.' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const [, refresh] = useState(0)
  const [notice, setNotice] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileInput = useRef(null)
  const completed = getCompletedQuestions()
  const done = getQuizProgress(completed)
  const wrong = getMistakeQuestions(getWrongQuestions()).length
  const reading = getDokkaiProgress()
  const writings = getCustomSakubun()
  const readingDone = dokkai.filter((passage) => reading[passage.id]).length
  const writingDone = kaiwaSakubun.sakubun.filter((topic) => writings[topic.id]?.text.trim()).length
  const cards = Object.values(flashcardDecks).flatMap((deck) => deck.cards)
  const mastered = new Set(getMasteredFlashcards())
  const masteredCount = cards.filter((card) => mastered.has(card.id)).length
  const history = [...getQuizHistory()].reverse().slice(0, 5)
  const [now, setNow] = useState(Date.now)
  const records = getSpacedRepetition()
  const roadmap = getStudyRoadmap()
  const studyPlan = buildStudyPlan(allQuizQuestions, records, completed, { now, studyPlan: roadmap })
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer) }, [])
  const percentage = Math.round(done / QUIZ_TOTAL * 100)
  const todayTask = studyPlan.roadmap?.todayEvent
  const continueTo = todayTask ? todayTask.kind === 'mock' ? '/exam' : '/exam?review=latest' : '/quiz'

  const restore = async (event) => {
    if (!user) return
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!window.confirm('Khôi phục sẽ thay thế các mục tiến độ có trong tệp sao lưu và đồng bộ thay đổi lên tài khoản, sang các thiết bị khác. Bạn muốn tiếp tục?')) return
    setImporting(true)
    setNotice(null)
    try {
      await importProgress(file)
      window.dispatchEvent(new Event('n3vjit:progress'))
      refresh((value) => value + 1)
      setNotice({ text: 'Đã khôi phục tiến độ học tập thành công.', error: false })
    } catch (error) {
      setNotice({ text: error instanceof SyntaxError ? 'Tệp không đúng định dạng JSON. Hãy chọn bản sao lưu N3-VJIT.' : error.message || 'Không thể khôi phục tiến độ.', error: true })
    } finally { setImporting(false) }
  }

  return (
    <div className="page-shell dashboard">
      <div className="page-heading">
        <div><p className="eyebrow">GÓC HỌC TẬP CỦA BẠN</p><h1>Hôm nay, mình học gì?</h1><p className="page-description">Một chút mỗi ngày, tiến gần N3 hơn.</p></div>
        <Link to={user ? '/account' : '/login'} className="local-badge"><ShieldCheck size={15} aria-hidden="true" />{user ? 'Tiến độ tự đồng bộ · Tài khoản' : 'Học thử · Đăng nhập để lưu tiến độ'}</Link>
      </div>
      <section className="study-hero" aria-labelledby="continue-heading">
        <div className="hero-copy">
          <span className="hero-kicker"><Sparkles size={15} aria-hidden="true" />LỊCH ÔN TỪNG NGÀY</span>
          <h2 id="continue-heading">{todayTask ? todayTask.kind === 'mock' ? 'Hôm nay dành cho thi thử' : 'Chữa đề, củng cố phần còn yếu' : studyPlan.dueCount ? 'Đến giờ củng cố kiến thức' : studyPlan.newCount ? 'Thêm một ít kiến thức mới' : 'Bạn đã xong lịch ôn hiện tại'}</h2>
          <p>{todayTask ? 'Lịch hôm nay không giao câu mới. Dành thời gian làm đề, xem lại đáp án và các câu sai.' : studyPlan.questions.length ? `${studyPlan.dueCount} câu đến hạn · Phiên tới: ${studyPlan.reviewCount} câu ôn + ${studyPlan.newCount} câu mới. Học từng phiên ngắn, giãn lịch khi nhớ đúng.` : studyPlan.nextDueAt ? `Lần ôn tiếp: ${formatReviewDate(studyPlan.nextDueAt)} (giờ Việt Nam). Nghỉ một chút rồi quay lại nhé.` : 'Bạn đã đủ câu mới hôm nay. Quay lại ngày mai để học tiếp.'}</p>
          <div className="flex flex-wrap gap-3">
            <Link to={continueTo} className="btn hero-primary">{todayTask ? todayTask.kind === 'mock' ? 'Bắt đầu thi thử' : 'Chữa đề gần nhất' : studyPlan.questions.length ? 'Mở phiên học hôm nay' : 'Xem lịch ôn'}<ArrowRight size={17} aria-hidden="true" /></Link>
            <Link to="/exam" className="btn hero-secondary"><ClipboardList size={17} aria-hidden="true" />Thi thử tổng hợp</Link>
          </div>
        </div>
        <div className="hero-progress">
          <div className="progress-ring" style={{ '--progress': `${percentage}%` }} role="img" aria-label={`Đã làm qua ${percentage}% ngân hàng câu hỏi`}>
            <div><strong>{percentage}<small>%</small></strong><span>đã làm qua</span></div>
          </div>
          <p>{done} / {QUIZ_TOTAL} câu hỏi</p>
        </div>
      </section>
      <StudyRoadmap stats={studyPlan} now={now} compact />
      <div className="stat-grid">
        <Stat icon={Target} label="Câu hỏi đã làm" value={done} detail={`/ ${QUIZ_TOTAL} câu`} to="/quiz" />
        <Stat icon={BookOpen} label="Bài đọc hoàn thành" value={readingDone} detail={`/ ${dokkai.length} bài`} to="/dokkai" />
        <Stat icon={Layers} label="Flashcard đã thuộc" value={masteredCount} detail={`/ ${cards.length} thẻ`} to="/flashcards" />
        <Stat icon={RotateCcw} label="Câu cần ôn lại" value={wrong} detail={wrong ? 'Luyện lại để ghi nhớ' : 'Sổ tay câu sai đang trống'} to="/mistakes" warning={wrong > 0} />
      </div>
      <div className="dashboard-columns">
        <section aria-labelledby="sections-heading">
          <div className="section-heading"><h2 id="sections-heading">Ôn tập theo chuyên đề</h2><Link to="/grammar" className="text-link">Tra cứu ngữ pháp<ArrowRight size={14} aria-hidden="true" /></Link></div>
          <div className="panel lesson-list">
            {quizSections.map((section, index) => {
              const count = getSectionProgress(section, completed)
              const total = section.questions.length
              const sectionPlan = buildStudyPlan(allQuizQuestions, records, completed, { now, sectionId: section.id, studyPlan: roadmap })
              return (
                <Link key={section.id} to={`/quiz?section=${section.id}`} className="lesson-row">
                  <span className={`lesson-number ${count === total ? 'is-complete' : ''}`}>{count === total ? <CheckCircle2 size={20} aria-hidden="true" /> : `0${index + 1}`}</span>
                  <div className="min-w-0 flex-1"><div className="lesson-title"><h3>{sectionNames[section.id]}</h3><span className="jp">{section.label}</span></div><div className="progress-track"><span style={{ width: `${count / total * 100}%` }} /></div><p>{count}/{total} câu đã làm · {sectionPlan.dueCount} đến hạn · {sectionPlan.newCount} mới trong phiên tới</p></div>
                  <ArrowRight size={18} className="lesson-arrow" aria-hidden="true" />
                </Link>
              )
            })}
          </div>
        </section>
        <aside className="space-y-5">
          <section className="panel practice-card" aria-labelledby="practice-heading">
            <span className="feature-icon"><Trophy size={22} aria-hidden="true" /></span>
            <p className="eyebrow mt-4">SẴN SÀNG THỬ SỨC?</p><h2 id="practice-heading">Một đề thi, một bước tiến</h2>
            <p>35 câu đọc hiểu, 2 bài đọc văn, 30 câu nghe và 1 bài viết. Ba phần chấm điểm cần đạt từ 3 điểm; bài viết không tính điểm.</p>
            <Link to="/exam" className="btn btn-primary w-full">Bắt đầu thi thử<ArrowRight size={17} aria-hidden="true" /></Link>
          </section>
          <Link to="/flashcards" className="panel flashcard-callout"><Layers size={25} aria-hidden="true" /><div><h3>Ghi nhớ với flashcard</h3><p>{cards.length - masteredCount} thẻ đang chờ bạn ôn tập</p></div><ArrowRight size={17} aria-hidden="true" /></Link>
        </aside>
      </div>
      <section aria-labelledby="skills-heading">
        <div className="section-heading"><h2 id="skills-heading">Rèn luyện thêm kỹ năng</h2><span className="text-sm text-[var(--muted)]">Học đều, nhớ lâu</span></div>
        <div className="skills-grid">
          {skills.map(({ to, name, jp, icon: Icon, description }) => (
            <Link to={to} key={to} className="panel skill-card"><div className="flex items-center justify-between"><span className="feature-icon"><Icon size={21} aria-hidden="true" /></span><span className="jp text-sm text-[var(--muted)]">{jp}</span></div><h3>{name}</h3><p>{description}</p><span className="skill-card-footer">{to === '/dokkai' ? `${readingDone}/${dokkai.length} bài hoàn thành` : to === '/sakubun' ? `${writingDone}/${kaiwaSakubun.sakubun.length} bài đã viết` : 'Vào luyện tập'}<ArrowRight size={15} aria-hidden="true" /></span></Link>
          ))}
        </div>
      </section>
      <section className="panel history-panel" aria-labelledby="history-heading">
        <div className="section-heading"><h2 id="history-heading"><History size={19} aria-hidden="true" />Lịch sử thi gần đây</h2><span className="text-sm text-[var(--muted)]">5 bài gần nhất</span></div>
        {history.length ? <div className="history-list">{history.map((result, index) => (
          <ExamHistoryRow key={result.id || `${result.date}-${index}`} result={result} />
        ))}</div> : <div className="empty-state"><ClipboardList size={30} aria-hidden="true" /><p>Chưa có bài thi nào. Thử một đề để biết mình đang ở đâu nhé.</p><Link to="/exam" className="text-link">Làm đề đầu tiên<ArrowRight size={15} aria-hidden="true" /></Link></div>}
      </section>
      {user && <section className="panel backup-panel" aria-labelledby="backup-heading">
        <div><h2 id="backup-heading"><ShieldCheck size={19} aria-hidden="true" />Giữ lại hành trình học của bạn</h2><p>{user ? 'Tiến độ tự đồng bộ theo tài khoản. Bạn vẫn có thể tải thêm tệp sao lưu để giữ một bản riêng.' : 'Khách có thể học thử. Đăng nhập để lưu tiến độ.'}</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => { try { exportProgress(); setNotice({ text: 'Đã tạo bản sao lưu. Kiểm tra tệp trong mục tải xuống.', error: false }) } catch { setNotice({ text: 'Không thể tạo bản sao lưu. Hãy thử lại.', error: true }) } }}><Download size={16} aria-hidden="true" />Sao lưu</button>
          <button type="button" className="btn btn-secondary" disabled={importing} onClick={() => fileInput.current?.click()}><Upload size={16} aria-hidden="true" />{importing ? 'Đang khôi phục…' : 'Khôi phục'}</button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" aria-label="Chọn tệp sao lưu tiến độ" onChange={restore} />
        </div>
        {notice && <p className={`notice ${notice.error ? 'notice-error' : 'notice-success'}`} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
        <details className="reset-details"><summary>Quản lý dữ liệu học tập</summary><p>{user ? 'Xóa tiến độ của tài khoản để bắt đầu lại. Thay đổi sẽ đồng bộ sang các thiết bị khác.' : 'Chế độ khách không lưu tiến độ.'} Hãy tải bản sao lưu trước nếu muốn giữ dữ liệu.</p><button type="button" className="btn btn-danger" onClick={() => { if (window.confirm(user ? 'Xóa toàn bộ tiến độ của tài khoản này? Thay đổi sẽ đồng bộ lên tài khoản và các thiết bị khác. Hãy chắc chắn bạn đã tải bản sao lưu nếu cần.' : 'Xóa toàn bộ tiến độ khách trên thiết bị này? Bạn chỉ có thể khôi phục nếu đã tải bản sao lưu.')) { resetAllProgress(); window.dispatchEvent(new Event('n3vjit:progress')); refresh((value) => value + 1); setNotice({ text: user ? 'Đã xóa tiến độ. Thay đổi sẽ được đồng bộ lên tài khoản.' : 'Chế độ khách không lưu tiến độ.', error: false }) } }}>Xóa tiến độ học tập</button></details>
      </section>
      }<p className="dashboard-footer">N3-VJIT · Mỗi lần ôn tập đều được tính.</p>
    </div>
  )
}

function Stat({ icon: Icon, label, value, detail, to, warning }) {
  return <Link to={to} className={`panel stat-card ${warning ? 'stat-warning' : ''}`}><span className="stat-icon"><Icon size={21} aria-hidden="true" /></span><p>{label}</p><div><strong>{value}</strong><span>{detail}</span></div></Link>
}

function ExamHistoryRow({ result }) {
  const date = new Date(result.date).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const time = result.elapsed != null ? ` · ${formatDuration(result.elapsed)}` : ''
  if (result.mode === 'mock-exam') {
    const labels = { passed: 'Đạt', failed: 'Không đạt', pending: 'Chờ chấm', excluded: 'Không tính điểm' }
    return <Link to={`/exam?attempt=${encodeURIComponent(result.id)}`} className="history-row history-mock-row"><span className="feature-icon"><ClipboardList size={18} aria-hidden="true" /></span><div className="min-w-0 flex-1"><h3>Thi thử tổng hợp · 4 phần</h3><p>{date}{time}</p><div className="history-part-scores">{result.sections.map((part) => <span key={part.id} className={`history-part-score status-${part.status}`}>{part.label}: {part.id === 'writing' ? 'không tính điểm' : part.score === null ? 'chờ chấm' : `${part.score.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}/10`}</span>)}</div></div><div className="history-score"><span className={`exam-status status-${result.status}`}>{labels[result.status]}</span><span className="mt-2">Xem bài & nhập điểm →</span></div></Link>
  }
  return <div className="history-row"><span className="feature-icon"><ClipboardList size={18} aria-hidden="true" /></span><div className="flex-1"><h3>Thi thử {result.total} câu</h3><p>{date}{time}</p></div><div className="history-score"><strong>{result.correct}/{result.total}</strong><span>{Math.round(result.correct / result.total * 100)}% chính xác</span></div></div>
}
