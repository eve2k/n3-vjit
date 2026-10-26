import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Dashboard from './components/Dashboard.jsx'
import { getTheme } from './utils/storage.js'
import { useAuth } from './context/authContext.js'

const QuizEngine = lazy(() => import('./components/QuizEngine.jsx'))
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

export default function App() {
  const location = useLocation()
  const { user, loading } = useAuth()
  const accountKey = user?.id || 'guest'
  const callbackParams = new URLSearchParams(location.hash.replace(/^#/, ''))
  const [theme, setTheme] = useState(getTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101722' : '#3658d4')
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
    <div className="min-h-svh pb-8">
      <Navbar theme={theme} onTheme={setTheme} />
      <div id="main-content" tabIndex={-1}>
        {loading ? <div className="page-shell loading-state" role="status">Đang khôi phục phiên đăng nhập…</div> :
        <Suspense fallback={<div className="page-shell loading-state" role="status">Đang mở bài học…</div>}>
          {location.pathname !== '/auth/callback' && (callbackParams.has('access_token') || callbackParams.has('error_code')) ? <Navigate to={`/auth/callback${location.hash}`} replace /> :
          <Routes>
            <Route path="/" element={<Dashboard key={accountKey} />} />
            <Route path="/quiz" element={new URLSearchParams(location.search).get('mode') === 'exam' ? <Navigate to="/exam" replace /> : <QuizEngine key={`${accountKey}:quiz${location.search}`} />} />
            <Route path="/exam" element={<MockExam key={`${accountKey}:exam${location.search}`} />} />
            <Route path="/dokkai" element={<DokkaiView key={accountKey} />} />
            <Route path="/choukai" element={<ChoukaiView key={accountKey} />} />
            <Route path="/flashcards" element={<FlashcardView key={accountKey} />} />
            <Route path="/grammar" element={<GrammarGuide key={accountKey} />} />
            <Route path="/kaiwa" element={<KaiwaSimulator key={accountKey} />} />
            <Route path="/sakubun" element={<SakubunStudio key={accountKey} />} />
            <Route path="/mistakes" element={<QuizEngine key={`${accountKey}:mistakes`} mistakeMode />} />
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
      </div>
    </div>
  )
}
