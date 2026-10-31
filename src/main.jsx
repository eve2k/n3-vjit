import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

import './redesign.css'
import App from './App.jsx'
import { preloadVoices } from './utils/tts.js'
import { getTheme } from './utils/storage.js'
import { AuthProvider } from './context/AuthContext.jsx'

document.documentElement.dataset.theme = getTheme()
preloadVoices()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
