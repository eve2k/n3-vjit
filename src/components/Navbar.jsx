import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { AlarmClock, BookOpen, ChevronRight, CircleUserRound, ClipboardCheck, GraduationCap, Headphones, Home, Layers3, LogIn, Menu, MessageCircle, Moon, PanelLeftClose, PanelLeftOpen, PenLine, Sun, X } from 'lucide-react'
import { getMasteryProgress, setTheme as persistTheme } from '../utils/storage.js'
import { weakMasteryCount } from '../utils/roadmapContent.js'
import { useAuth } from '../context/authContext.js'
import SyncStatus from './SyncStatus.jsx'

const MOBILE_QUERY = '(max-width: 820px)'
const subscribeToViewport = callback => {
  const media = window.matchMedia(MOBILE_QUERY)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
const getMobileSnapshot = () => window.matchMedia(MOBILE_QUERY).matches

const primaryLinks = [
  { to: '/', label: 'Lộ trình học', icon: Home, end: true },
  { to: '/review', label: 'Câu cần ôn', icon: AlarmClock, count: true },
  { to: '/exam', label: 'Thi thử', icon: ClipboardCheck },
]
const skillLinks = [
  { to: '/dokkai', label: 'Đọc hiểu', icon: BookOpen },
  { to: '/choukai', label: 'Nghe', icon: Headphones },
  { to: '/kaiwa', label: 'Hội thoại', icon: MessageCircle },
  { to: '/sakubun', label: 'Viết bài', icon: PenLine },
]
const toolLinks = [
  { to: '/flashcards', label: 'Flashcard', icon: Layers3 },
  { to: '/grammar', label: 'Ngữ pháp', icon: GraduationCap },
]

function Item({ to, label, icon: Icon, end = false, count = false, reviewCount = 0, onClick }) {
  return <NavLink to={to} end={end} onClick={onClick} title={label} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}><Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>{count && reviewCount > 0 && <b className="sidebar-badge" aria-label={`${reviewCount} thẻ cần củng cố`}>{reviewCount}</b>}</NavLink>
}

export default function Navbar({ theme, onTheme }) {
  const { user, loading, progressVersion } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('n3vjit_sidebar_collapsed') === 'true')
  const [menuOpen, setMenuOpen] = useState(false)
  const countWeak = () => weakMasteryCount(getMasteryProgress())
  const [reviewCount, setReviewCount] = useState(countWeak)
  const isMobile = useSyncExternalStore(subscribeToViewport, getMobileSnapshot, () => false)
  useEffect(() => {
    const update = () => setReviewCount(countWeak())
    update()
    window.addEventListener('n3vjit:progress-write', update)
    window.addEventListener('n3vjit:progress', update)
    window.addEventListener('storage', update)
    return () => { window.removeEventListener('n3vjit:progress-write', update); window.removeEventListener('n3vjit:progress', update); window.removeEventListener('storage', update) }
  }, [user, progressVersion])
  useEffect(() => {
    if (!menuOpen) return undefined
    const close = event => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [menuOpen])
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'modern' : 'dark'
    persistTheme(next)
    onTheme(next)
  }
  const themeLabel = theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'
  const renderItems = links => links.map(link => <Item key={link.to} {...link} reviewCount={reviewCount} onClick={() => setMenuOpen(false)} />)

  return <>
    <aside className={`sidebar${collapsed && !isMobile ? ' is-collapsed' : ''}`} aria-label="Điều hướng chính">
      <div className="sidebar-brand-row"><NavLink to="/" className="sidebar-brand" aria-label="C2J Study, lộ trình học"><span className="sidebar-brand-mark"><span>C2J</span></span><span><strong>C2J Study</strong><small>HUTECH · VJIT</small></span></NavLink><div className="sidebar-header-actions"><button type="button" className="sidebar-theme" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel} aria-pressed={theme === 'dark'}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><button type="button" className="sidebar-collapse" aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'} title={collapsed ? 'Mở rộng' : 'Thu gọn'} onClick={() => setCollapsed(value => { localStorage.setItem('n3vjit_sidebar_collapsed', String(!value)); return !value })}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button></div></div>
      <nav className="sidebar-nav">
        <p className="sidebar-label">HỌC TẬP</p>{renderItems(primaryLinks)}
        <p className="sidebar-label sidebar-label-spaced">LUYỆN KỸ NĂNG</p>{renderItems(skillLinks)}
        <p className="sidebar-label sidebar-label-spaced">CÔNG CỤ</p>{renderItems(toolLinks)}
      </nav>
      <div className="sidebar-bottom">
        {!loading && <NavLink to={user ? '/account' : '/login'} title={user ? user.email : 'Đăng nhập'} className="sidebar-account">{user ? <CircleUserRound size={19} /> : <LogIn size={19} />}<span><strong>{user ? (user.user_metadata?.display_name || 'Tài khoản') : 'Đăng nhập'}</strong><small>{user ? user.email : 'Lưu tiến độ học tập'}</small>{user && <SyncStatus compact />}</span><ChevronRight size={16} /></NavLink>}
      </div>
    </aside>
    {menuOpen && <div className="mobile-more-menu" id="mobile-more-menu" aria-label="Luyện kỹ năng và công cụ"><div className="mobile-more-header"><strong>Khám phá</strong><button type="button" aria-label="Đóng menu" onClick={() => setMenuOpen(false)}><X size={20}/></button></div><p className="sidebar-label">LUYỆN KỸ NĂNG</p>{renderItems(skillLinks)}<p className="sidebar-label sidebar-label-spaced">CÔNG CỤ</p>{renderItems(toolLinks)}</div>}
    <nav className="mobile-nav" aria-label="Điều hướng nhanh">
      {primaryLinks.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}><Icon size={19} aria-hidden="true" /><span>{label}</span>{to === '/review' && reviewCount > 0 && <b className="mobile-review-badge">{reviewCount}</b>}</NavLink>)}
      <button type="button" className={`mobile-nav-link${menuOpen || [...skillLinks, ...toolLinks].some(link => location.pathname === link.to) ? ' active' : ''}`} onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen} aria-controls="mobile-more-menu"><Menu size={19} aria-hidden="true"/><span>Thêm</span></button>
      <NavLink to={user ? '/account' : '/login'} onClick={() => setMenuOpen(false)} className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}><CircleUserRound size={19} aria-hidden="true" /><span>Tài khoản</span></NavLink>
    </nav>
  </>
}
