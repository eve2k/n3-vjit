import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Dashboard from './components/Dashboard.jsx'
import { getTheme } from './utils/storage.js'

const QuizEngine = lazy(() => import('./components/QuizEngine.jsx'))
const MockExam = lazy(() => import('./components/MockExam.jsx'))
const DokkaiView = lazy(() => import('./components/DokkaiView.jsx'))
const ChoukaiView = lazy(() => import('./components/ChoukaiView.jsx'))
const FlashcardView = lazy(() => import('./components/FlashcardView.jsx'))
const KaiwaSimulator = lazy(() => import('./components/KaiwaSimulator.jsx'))
const SakubunStudio = lazy(() => import('./components/SakubunStudio.jsx'))
const GrammarGuide = lazy(() => import('./components/GrammarGuide.jsx'))

export default function App() {
  const location = useLocation()
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
        <Suspense fallback={<div className="page-shell loading-state" role="status">Đang mở bài học…</div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/quiz" element={new URLSearchParams(location.search).get('mode') === 'exam' ? <Navigate to="/exam" replace /> : <QuizEngine key={`quiz${location.search}`} />} />
            <Route path="/exam" element={<MockExam key={`exam${location.search}`} />} />
            <Route path="/dokkai" element={<DokkaiView />} />
            <Route path="/choukai" element={<ChoukaiView />} />
            <Route path="/flashcards" element={<FlashcardView />} />
            <Route path="/grammar" element={<GrammarGuide />} />
            <Route path="/kaiwa" element={<KaiwaSimulator />} />
            <Route path="/sakubun" element={<SakubunStudio />} />
            <Route path="/mistakes" element={<QuizEngine key="mistakes" mistakeMode />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  )
}
