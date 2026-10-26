import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { BookOpen, CalendarDays, CheckCheck, ClipboardList, GraduationCap, Headphones, Layers, LayoutDashboard, MessageCircle, PenLine, Sun, Moon } from 'lucide-react'
import { setTheme as persistTheme } from '../utils/storage.js'

const EXAM = new Date('2026-11-21T08:00:00+07:00')
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

function countdown() {
  const days = Math.ceil((EXAM.getTime() - Date.now()) / 86400000)
  return days > 0 ? `Còn ${days} ngày · Thi 21/11` : 'Tiếp tục hành trình N3'
}

export default function Navbar({ theme, onTheme }) {
  const [clock, setClock] = useState(countdown)
  useEffect(() => {
    const id = setInterval(() => setClock(countdown()), 60000)
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
          <span className="exam-countdown"><CalendarDays size={15} aria-hidden="true" />{clock}</span>
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
