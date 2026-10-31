import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import { getTheme } from './utils/storage.js'
import { useAuth } from './context/authContext.js'
import { refreshQuestionBank } from './services/questionBank.js'

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
  const { user, loading, sync, isAdmin, adminLoading } = useAuth()
  const accountKey = user?.id || 'guest'
  const inAdmin = location.pathname.startsWith('/admin')
  const hideNavbar = ['/login', '/register', '/forgot-password', '/reset-password', '/study', '/review/test'].includes(location.pathname) || location.pathname.startsWith('/auth/') || /^\/study\/[^/]+\/[^/]+\/(?:learn|summary)$/.test(location.pathname)
  const callbackParams = new URLSearchParams(location.hash.replace(/^#/, ''))
  const callbackQuery = new URLSearchParams(location.search)
  const [theme, setTheme] = useState(getTheme)
  const [bankVersion, setBankVersion] = useState(0)
  const [waitingWorker, setWaitingWorker] = useState(null)
  const [updatingApp, setUpdatingApp] = useState(false)
  const updatingAppRef = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
    let registration
    let disposed = false
    let reloadStarted = false
    const announceWaiting = () => {
      if (!disposed && registration?.waiting && navigator.serviceWorker.controller) setWaitingWorker(registration.waiting)
    }
    const watchInstalling = () => {
      const worker = registration?.installing
      if (!worker) return
      worker.addEventListener('statechange', announceWaiting)
    }
    const checkForUpdate = () => registration?.update().catch(() => {})
    const onVisibility = () => { if (document.visibilityState === 'visible') checkForUpdate() }
    const onControllerChange = () => {
      if (!updatingAppRef.current || reloadStarted) return
      reloadStarted = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    document.addEventListener('visibilitychange', onVisibility)
    navigator.serviceWorker.register('/sw.js').then(value => {
      if (disposed) return
      registration = value
      announceWaiting()
      registration.addEventListener('updatefound', watchInstalling)
      watchInstalling()
      checkForUpdate()
    }).catch(() => {})
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibility)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      registration?.removeEventListener('updatefound', watchInstalling)
    }
  }, [])

  const updateApp = () => {
    if (!waitingWorker) return
    updatingAppRef.current = true
    setUpdatingApp(true)
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }

  useEffect(() => { refreshQuestionBank() }, [])
  useEffect(() => { const update = () => setBankVersion(value => value + 1); window.addEventListener('n3vjit:question-bank', update); return () => window.removeEventListener('n3vjit:question-bank', update) }, [])

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
    <div className={`app-frame ${hideNavbar || inAdmin ? 'focused-frame' : ''}`}>
      {waitingWorker && <div className="app-update-banner" role="status" aria-live="polite">
        <span>Có phiên bản mới sẵn sàng.</span>
        <button className="btn btn-primary" type="button" onClick={updateApp} disabled={updatingApp}>{updatingApp ? 'Đang cập nhật…' : 'Tải phiên bản mới'}</button>
      </div>}
      {!hideNavbar && !inAdmin && <Navbar theme={theme} onTheme={setTheme} />}
      <main className="app-content" id="main-content" tabIndex={-1}>
        {loading || (user && !sync.ready && location.pathname !== '/auth/callback') ? <div className="page-shell loading-state" role="status">{loading ? 'Đang khôi phục phiên đăng nhập…' : 'Đang tải tiến độ học tập…'}</div> :
        <Suspense fallback={<div className="page-shell loading-state" role="status">Đang mở bài học…</div>}>
          {location.pathname !== '/auth/callback' && (callbackParams.has('access_token') || callbackParams.has('error_code') || callbackQuery.has('error_code') || callbackQuery.has('error')) ? <Navigate to={`/auth/callback${location.search}${location.hash}`} replace /> :
          <Routes key={bankVersion}>
            <Route path="/" element={<StudyRoadmap key={accountKey} />} />
            <Route path="/dashboard" element={<Dashboard key={accountKey} />} />
            <Route path="/quiz" element={new URLSearchParams(location.search).get('mode') === 'exam' ? <Navigate to="/exam" replace /> : <QuizEngine key={`${accountKey}:quiz${location.search}`} />} />
            <Route path="/study/:stageId/:nodeId/summary" element={<MasterySummary key={accountKey} />} />
            <Route path="/study/:stageId/:nodeId/learn" element={<MasteryStudy key={accountKey} />} />
            <Route path="/study/:stageId/:nodeId" element={<MasteryPreview key={accountKey} />} />
            <Route path="/study" element={<Navigate to="/" replace />} />
            <Route path="/admin/*" element={!user ? <Navigate to="/login" replace /> : adminLoading ? <div className="page-shell loading-state" role="status">Đang kiểm tra quyền quản trị…</div> : isAdmin ? <AdminDashboard bankVersion={bankVersion} /> : <Navigate to="/" replace />} />
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
