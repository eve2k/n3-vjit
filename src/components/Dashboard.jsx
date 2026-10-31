import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, BookOpen, Check, CircleHelp, Headphones, Layers3, RotateCcw, Sparkles, Target, Trophy, Upload, Download, PenLine, MessageCircle } from 'lucide-react'
import { allQuizQuestions, quizSections, QUIZ_TOTAL, dokkai, flashcardDecks } from '../data/index.js'
import { exportProgress, getCompletedQuestions, getDokkaiProgress, getMasteredFlashcards, getMasteryProgress, getQuizHistory, getSpacedRepetition, getStudyRoadmap, getWrongQuestions, importProgress } from '../utils/storage.js'
import { formatDuration, getMistakeQuestions, getQuizProgress, getSectionProgress } from '../utils/learning.js'
import { buildStudyPlan } from '../utils/spacedRepetition.js'
import { continueLessonIndex, recommendedStageIndex, stages, weakMasteryCount } from '../utils/roadmapContent.js'
import { useAuth } from '../context/authContext.js'
import DailyStudyOverview from './DailyStudyOverview.jsx'

const SECTION_NAMES = { fukushuu1: 'Đồng nghĩa', renshuu2: 'Từ vựng', renshuu3: 'Kanji', renshuu4: 'Ngữ pháp', renshuu5: 'Chia thể' }
const AREAS = [
  { to: '/dokkai', label: 'Đọc hiểu', japanese: '読解', icon: BookOpen, color: 'sage', detail: 'Đọc đoạn văn, tìm ý chính' },
  { to: '/choukai', label: 'Nghe', japanese: '聴解', icon: Headphones, color: 'blue', detail: 'Luyện nghe theo tình huống' },
  { to: '/flashcards', label: 'Flashcard', japanese: '単語', icon: Layers3, color: 'amber', detail: 'Ôn từ và cấu trúc' },
  { to: '/grammar', label: 'Ngữ pháp', japanese: '文法', icon: CircleHelp, color: 'violet', detail: 'Tra cứu và ôn mẫu câu' },
  { to: '/kaiwa', label: 'Hội thoại', japanese: '会話', icon: MessageCircle, color: 'rose', detail: 'Thực hành hỏi đáp' },
  { to: '/sakubun', label: 'Viết bài', japanese: '作文', icon: PenLine, color: 'teal', detail: 'Viết và xem bài mẫu' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const fileInput = useRef(null)
  const [now, setNow] = useState(Date.now)
  const [notice, setNotice] = useState(null)
  const [importing, setImporting] = useState(false)
  const completed = getCompletedQuestions()
  const mastery = getMasteryProgress()
  const todayPlan = buildStudyPlan(allQuizQuestions, getSpacedRepetition(), completed, { now, studyPlan: getStudyRoadmap() })
  const recommended = stages[recommendedStageIndex(completed, mastery)]
  const recommendedLesson = recommended.lessons[continueLessonIndex(recommended, completed, mastery)]
  const weakCount = weakMasteryCount(mastery)
  const done = getQuizProgress(completed)
  const percent = Math.round(done / QUIZ_TOTAL * 100)
  const mastered = new Set(getMasteredFlashcards())
  const flashcards = Object.values(flashcardDecks).flatMap(deck => deck.cards)
  const wrongCount = getMistakeQuestions(getWrongQuestions()).length
  const readingProgress = getDokkaiProgress()
  const readingDone = dokkai.filter(passage => readingProgress[passage.id]).length
  const history = [...getQuizHistory()].reverse().slice(0, 3)
  const firstName = user?.user_metadata?.display_name?.trim()?.split(/\s+/).at(-1)

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer) }, [])
  const restore = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user) return
    setImporting(true); setNotice(null)
    try {
      await importProgress(file)
      window.dispatchEvent(new Event('n3vjit:progress'))
      setNotice({ text: 'Đã khôi phục tiến độ học tập.', type: 'success' })
    } catch (error) {
      setNotice({ text: error.message || 'Không thể khôi phục tệp tiến độ.', type: 'error' })
    } finally { setImporting(false) }
  }

  return <div className="page-shell home-page">
    {!user && <div className="guest-callout"><span>Đang dùng thử</span><p>Đăng nhập để lưu tiến độ và tiếp tục học trên thiết bị khác.</p><Link to="/login">Đăng nhập <ArrowRight size={15} /></Link></div>}
    <header className="home-heading"><div><p className="eyebrow">TỔNG QUAN HỌC TẬP · N3 VJIT</p><h1>{firstName ? `Chào ${firstName}, hôm nay học gì?` : 'Hôm nay, mình học gì?'}</h1><p className="page-description">Một phiên học vừa sức giúp bạn tiến gần hơn đến ngày thi.</p></div><div className="home-date"><span>{new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(now)}</span><strong>{new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long' }).format(now)}</strong></div></header>

    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-copy"><span className="home-hero-kicker"><Sparkles size={15} /> GỢI Ý HỌC HÔM NAY</span>
        <h2 id="home-hero-title">{recommended.last ? 'Luyện đề thi thử' : `${recommended.title} · ${recommendedLesson}`}</h2>
        <p>{recommended.last ? 'Bạn đã đi qua các chặng học. Tiếp tục luyện đề để chuẩn bị cho ngày thi.' : `Tiếp tục chặng ${recommended.title} theo lộ trình hiện tại.`}</p>
        <div className="home-hero-actions"><Link to={recommended.last ? '/exam' : '/'} className="btn btn-primary hero-action">{recommended.last ? 'Mở đề thi thử' : 'Tiếp tục lộ trình'}<ArrowRight size={17} /></Link><Link to="/study" className="hero-quiet-link">Chọn chuyên đề khác <ArrowUpRight size={15} /></Link></div>
      </div>
      <span className="hero-watermark" aria-hidden="true">N3</span>
    </section>

    <DailyStudyOverview plan={todayPlan} weakCount={weakCount} />

    <div className="home-main-grid">
      <section className="home-section" aria-labelledby="course-title">
        <div className="section-title-row"><div><p className="eyebrow">NGÂN HÀNG CÂU HỎI</p><h2 id="course-title">Học theo chuyên đề</h2></div><Link to="/quiz" className="section-link">Mở toàn bộ <ArrowRight size={15} /></Link></div>
        <div className="course-list">{quizSections.map((section, index) => {
          const count = getSectionProgress(section, completed)
          const total = section.questions.length
          const ratio = Math.round(count / total * 100)
          return <Link key={section.id} to={`/quiz?section=${section.id}`} className="course-row"><span className={`course-index ${count === total ? 'complete' : ''}`}>{count === total ? <Check size={17} /> : String(index + 1).padStart(2, '0')}</span><span className="course-copy"><span className="course-name"><strong>{SECTION_NAMES[section.id]}</strong><span className="jp">{section.label}</span></span><span className="course-track"><span style={{ width: `${ratio}%` }} /></span><small>{count} / {total} câu · {ratio}%</small></span><ArrowRight size={17} className="course-arrow" /></Link>
        })}</div>
      </section>
      <aside className="home-side-column">
        <section className="study-tip-card"><span className="metric-icon green"><BookOpen size={18} /></span><p className="eyebrow">CÁCH HỌC</p><h2>Học từng phần</h2><p>Chọn một chuyên đề, làm lần lượt các câu hỏi và đọc giải thích sau mỗi câu. Tiến độ sẽ lưu vào tài khoản.</p><Link to="/study" className="btn btn-secondary">Chọn phần học <ArrowRight size={15} /></Link></section>
        <section className="exam-teaser"><span className="metric-icon blue"><Trophy size={18} /></span><p className="eyebrow">LÀM QUEN VỚI PHÒNG THI</p><h2>Thi thử tổng hợp</h2><p>35 câu đọc hiểu · 2 bài đọc · 30 câu nghe. Mỗi phần chấm riêng, từ 3 điểm là đạt.</p><Link to="/exam" className="btn btn-secondary">Xem đề thi <ArrowRight size={15} /></Link></section>
      </aside>
    </div>

    <div className="home-metrics" aria-label="Tiến độ học tập">
      <article className="metric-card"><span className="metric-icon green"><Target size={18} /></span><strong>{done}<small> / {QUIZ_TOTAL}</small></strong><span>Câu hỏi đã làm</span><div className="progress-track"><span style={{ width: `${percent}%` }} /></div></article>
      <article className="metric-card"><span className="metric-icon amber"><BookOpen size={18} /></span><strong>{readingDone}<small> / {dokkai.length}</small></strong><span>Bài đọc đã hoàn thành</span><Link to="/dokkai">Mở phần đọc hiểu <ArrowRight size={13} /></Link></article>
      <article className="metric-card"><span className="metric-icon violet"><Layers3 size={18} /></span><strong>{mastered.size}<small> / {flashcards.length}</small></strong><span>Flashcard đã thuộc</span><Link to="/flashcards">Ôn flashcard <ArrowRight size={13} /></Link></article>
      <article className="metric-card"><span className="metric-icon rose"><RotateCcw size={18} /></span><strong>{wrongCount}</strong><span>Câu cần củng cố</span><Link to="/mistakes">Xem câu sai <ArrowRight size={13} /></Link></article>
    </div>

    <section className="home-section skill-section" aria-labelledby="skills-title"><div className="section-title-row"><div><p className="eyebrow">LUYỆN ĐỦ CÁC KỸ NĂNG</p><h2 id="skills-title">Chọn phần muốn học</h2></div></div><div className="skill-grid">{AREAS.map(({ to, label, japanese, icon: Icon, color, detail }) => <Link key={to} to={to} className="skill-card"><span className={`metric-icon ${color}`}><Icon size={19} /></span><span className="skill-copy"><strong>{label}</strong><small>{label === 'Đọc hiểu' ? `${readingDone}/${dokkai.length} bài đã học` : detail}</small></span><span className="skill-jp jp">{japanese}</span><ArrowUpRight size={16} className="skill-open" /></Link>)}</div></section>

    {(history.length || user) && <section className="home-bottom-grid"><div className="home-section"><div className="section-title-row"><div><p className="eyebrow">HOẠT ĐỘNG GẦN ĐÂY</p><h2>Kết quả thi thử</h2></div><Link to="/exam" className="section-link">Mở lịch sử <ArrowRight size={15} /></Link></div>{history.length ? <div className="recent-list">{history.map(item => <Link key={item.id || item.date} to={`/exam?review=${encodeURIComponent(item.id)}`} className="recent-row"><span className="recent-result"><strong>{item.correct}/{item.total}</strong><small>câu đúng</small></span><span><strong>{item.status === 'passed' ? 'Hoàn thành đề' : item.status === 'failed' ? 'Cần ôn thêm' : 'Chờ chấm'}</strong><small>{new Date(item.date).toLocaleDateString('vi-VN')} · {formatDuration(item.elapsed)}</small></span><ArrowRight size={16} /></Link>)}</div> : <div className="quiet-empty"><Trophy size={20} /><span>Bài thi đã nộp sẽ xuất hiện ở đây.</span></div>}</div>
      {user && <div className="backup-card"><div><p className="eyebrow">DỮ LIỆU CỦA BẠN</p><h2>Sao lưu tiến độ</h2><p>Tải bản sao hoặc khôi phục dữ liệu đã lưu trước đó.</p></div>{notice && <p className={`notice notice-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</p>}<div className="backup-actions"><button type="button" className="btn btn-secondary" onClick={() => exportProgress()}><Download size={15} />Tải bản sao</button><button type="button" className="btn btn-secondary" disabled={importing} onClick={() => fileInput.current?.click()}><Upload size={15} />{importing ? 'Đang khôi phục…' : 'Khôi phục'}</button><input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={restore} /></div></div>}</section>}
  </div>
}
