import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import { getTheme } from './utils/storage.js'
import { useAuth } from './context/authContext.js'

const Dashboard = lazy(() => import('./components/Dashboard.jsx'))
const StudyRoadmap = lazy(() => import('./components/StudyRoadmap.jsx'))
const MasteryPreview = lazy(() => import('./components/MasteryPreview.jsx'))
const MasteryStudy = lazy(() => import('./components/MasteryStudy.jsx'))
const MasterySummary = lazy(() => import('./components/MasterySummary.jsx'))
const QuizEngine = lazy(() => import('./components/QuizEngine.jsx'))
const ReviewPage = lazy(() => import('./components/ReviewPage.jsx'))
const ReviewTest = lazy(() => import('./components/ReviewTest.jsx'))
const MockExam = lazy(() => import('./components/MockExam.jsx'))
const DokkaiView = lazy(() => import('./components/DokkaiView.jsx'))
const ChoukaiView = lazy(() => import('./components/ChoukaiView.jsx'))
const FlashcardView = lazy(() => import('./components/FlashcardView.jsx'))
const KaiwaSimulator = lazy(() => import('./components/KaiwaSimulator.jsx'))
const SakubunStudio = lazy(() => import('./components/SakubunStudio.jsx'))
const GrammarGuide = lazy(() => import('./components/GrammarGuide.jsx'))
const AuthPage = lazy(() => import('./components/AuthPage.jsx'))
const AuthCallback = lazy(() => import('./components/AuthCallback.jsx'))
const AccountPage = lazy(() => import('./components/AccountPage.jsx'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard.jsx'))

export default function App() {
  const location = useLocation()
  const { user, loading, sync, isAdmin, adminLoading, adminError } = useAuth()
  const accountKey = user?.id || 'guest'
  const hideNavbar = ['/login', '/register', '/forgot-password', '/reset-password', '/study', '/review/test'].includes(location.pathname) || location.pathname.startsWith('/auth/') || /^\/study\/[^/]+\/[^/]+\/(?:learn|summary)$/.test(location.pathname)
  const callbackParams = new URLSearchParams(location.hash.replace(/^#/, ''))
  const callbackQuery = new URLSearchParams(location.search)
  const [theme, setTheme] = useState(getTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111915' : '#174c3b')
  }, [theme])

  useEffect(() => {
    const syncTheme = () => setTheme(getTheme())
    window.addEventListener('n3vjit:progress', syncTheme)
    window.addEventListener('storage', syncTheme)
    return () => {
      window.removeEventListener('n3vjit:progress', syncTheme)
      window.removeEventListener('storage', syncTheme)
    }
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [location.pathname, location.search])

  return (
    <div className={`app-frame ${hideNavbar ? 'focused-frame' : ''}`}>
      {!hideNavbar && <Navbar theme={theme} onTheme={setTheme} />}
      <main className="app-content" id="main-content" tabIndex={-1}>
        {loading || (user && !sync.ready && location.pathname !== '/auth/callback') ? <div className="page-shell loading-state" role="status">{loading ? 'Đang khôi phục phiên đăng nhập…' : 'Đang tải tiến độ học tập…'}</div> :
        <Suspense fallback={<div className="page-shell loading-state" role="status">Đang mở bài học…</div>}>
          {location.pathname !== '/auth/callback' && (callbackParams.has('access_token') || callbackParams.has('error_code') || callbackQuery.has('error_code') || callbackQuery.has('error')) ? <Navigate to={`/auth/callback${location.search}${location.hash}`} replace /> :
          <Routes>
            <Route path="/" element={<StudyRoadmap key={accountKey} />} />
            <Route path="/dashboard" element={<Dashboard key={accountKey} />} />
            <Route path="/quiz" element={new URLSearchParams(location.search).get('mode') === 'exam' ? <Navigate to="/exam" replace /> : <QuizEngine key={`${accountKey}:quiz${location.search}`} />} />
            <Route path="/study/:stageId/:nodeId/summary" element={<MasterySummary key={accountKey} />} />
            <Route path="/study/:stageId/:nodeId/learn" element={<MasteryStudy key={accountKey} />} />
            <Route path="/study/:stageId/:nodeId" element={<MasteryPreview key={accountKey} />} />
            <Route path="/study" element={<Navigate to="/" replace />} />
            <Route path="/admin" element={!user ? <Navigate to="/login" replace /> : adminLoading ? <div className="page-shell loading-state" role="status">Đang kiểm tra quyền quản trị…</div> : isAdmin ? <AdminDashboard /> : user.email?.toLowerCase() === 'nguyeenhuynhlong@gmail.com' ? <section className="page-shell panel admin-setup-notice"><h1>Chưa bật được quyền quản trị</h1><p>Chạy migration <code>supabase/migrations/20261027_admin_roles.sql</code> trong Supabase SQL Editor. Nếu tài khoản chưa tồn tại lúc chạy migration, hãy xác minh đúng tài khoản rồi cấp role bằng câu lệnh một lần:</p><pre>{`insert into n3vjit_private.admin_roles(user_id)\nselect id from auth.users where lower(email) = 'nguyeenhuynhlong@gmail.com'\non conflict (user_id) do nothing;`}</pre><p>{adminError ? 'Nếu vừa chạy migration, tải lại trang sau khi Supabase hoàn tất.' : 'Chỉ project owner nên chạy câu lệnh cấp role sau khi đã xác minh chủ tài khoản.'}</p></section> : <Navigate to="/" replace />} />
            <Route path="/exam" element={<MockExam key={`${accountKey}:exam${location.search}`} />} />
            <Route path="/dokkai" element={<DokkaiView key={accountKey} />} />
            <Route path="/choukai" element={<ChoukaiView key={accountKey} />} />
            <Route path="/flashcards" element={<FlashcardView key={accountKey} />} />
            <Route path="/grammar" element={<GrammarGuide key={accountKey} />} />
            <Route path="/kaiwa" element={<KaiwaSimulator key={accountKey} />} />
            <Route path="/sakubun" element={<SakubunStudio key={accountKey} />} />
            <Route path="/review" element={<ReviewPage key={accountKey} />} />
            <Route path="/review/test" element={<ReviewTest key={accountKey} />} />
            <Route path="/mistakes" element={<Navigate to="/review" replace />} />
            <Route path="/login" element={<AuthPage key="login" mode="login" />} />
            <Route path="/register" element={<AuthPage key="register" mode="register" />} />
            <Route path="/forgot-password" element={<AuthPage key="forgot" mode="forgot" />} />
            <Route path="/reset-password" element={<AuthPage key="reset" mode="reset" />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/account" element={<AccountPage key={accountKey} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          }
        </Suspense>
        }
      </main>
    </div>
  )
}
