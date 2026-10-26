import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { BookOpen, CalendarDays, CheckCheck, ClipboardList, GraduationCap, Headphones, Layers, LayoutDashboard, LogIn, MessageCircle, PenLine, Sun, Moon, UserRound } from 'lucide-react'
import { getStudyRoadmap, setTheme as persistTheme } from '../utils/storage.js'
import { studyDay } from '../utils/spacedRepetition.js'
import { daysBetween, DEFAULT_EXAM_DATE, formatStudyDay } from '../utils/studyRoadmap.js'
import { useAuth } from '../context/authContext.js'
import SyncStatus from './SyncStatus.jsx'

const links = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/quiz', label: 'Luyện câu hỏi', icon: ClipboardList },
  { to: '/exam', label: 'Thi thử', icon: CheckCheck },
  { to: '/dokkai', label: 'Đọc hiểu', icon: BookOpen },
  { to: '/choukai', label: 'Luyện nghe', icon: Headphones },
  { to: '/flashcards', label: 'Flashcard', icon: Layers },
  { to: '/grammar', label: 'Ngữ pháp', icon: GraduationCap },
  { to: '/kaiwa', label: 'Hội thoại', icon: MessageCircle },
  { to: '/sakubun', label: 'Viết bài', icon: PenLine },
  { to: '/mistakes', label: 'Câu sai', icon: CheckCheck },
]

function countdown(now, examDate) {
  const days = daysBetween(studyDay(now), examDate)
  return days > 0 ? `Còn ${days} ngày · Thi ${formatStudyDay(examDate)}` : days === 0 ? 'Hôm nay là ngày thi' : 'Tiếp tục hành trình N3'
}

export default function Navbar({ theme, onTheme }) {
  const { user, loading } = useAuth()
  const [now, setNow] = useState(Date.now)
  const clock = countdown(now, getStudyRoadmap()?.examDate || DEFAULT_EXAM_DATE)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="site-header">
      <a href="#main-content" className="skip-link">Đến nội dung chính</a>
      <div className="header-inner">
        <NavLink to="/" className="brand" aria-label="N3-VJIT — Trang tổng quan">
          <span className="brand-icon"><GraduationCap size={24} aria-hidden="true" /></span>
          <span><strong>N3<span className="text-[var(--accent)]">・</span>VJIT</strong><small>Học đều mỗi ngày</small></span>
        </NavLink>
        <div className="flex items-center gap-3">
          <SyncStatus compact />
          <span className="exam-countdown"><CalendarDays size={15} aria-hidden="true" />{clock}</span>
          {!loading && <NavLink to={user ? '/account' : '/login'} className="btn btn-secondary nav-account-link" aria-label={user ? 'Mở tài khoản của tôi' : 'Đăng nhập hoặc đăng ký'}>{user ? <UserRound size={17} aria-hidden="true" /> : <LogIn size={17} aria-hidden="true" />}<span>{user ? 'Tài khoản' : 'Đăng nhập'}</span></NavLink>}
          <button type="button" className="icon-button"
            title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            aria-pressed={theme === 'dark'}
            onClick={() => { const next = theme === 'dark' ? 'modern' : 'dark'; persistTheme(next); onTheme(next) }}>
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </div>
      </div>
      <nav className="study-nav" aria-label="Các phần học">
        <div className="study-nav-inner">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `study-nav-link ${isActive ? 'is-active' : ''}`}>
              <Icon size={16} aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  )
}
