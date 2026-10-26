import { useEffect, useState } from 'react'
import { AuthContext } from './authContext.js'
import { authClient } from '../services/auth.js'
import { setStorageUser } from '../utils/storage.js'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(() => authClient.configured && authClient.hasStoredSession())
  const [restoreError, setRestoreError] = useState(false)

  useEffect(() => {
    let active = true
    const unsubscribe = authClient.subscribe((next) => {
      setStorageUser(next?.user.id || null)
      setSession(next)
      setRestoreError(false)
    })
    authClient.restoreSession().catch(() => { if (active) setRestoreError(true) }).finally(() => { if (active) setLoading(false) })
    const storageChanged = (event) => {
      if (event.key === authClient.storageKey) authClient.syncStorage().catch(() => { if (active) setRestoreError(true) })
    }
    const refresh = () => authClient.refreshIfNeeded().catch(() => { if (active) setRestoreError(true) })
    const timer = setInterval(refresh, 30000)
    window.addEventListener('storage', storageChanged)
    window.addEventListener('focus', refresh)
    return () => { active = false; unsubscribe(); clearInterval(timer); window.removeEventListener('storage', storageChanged); window.removeEventListener('focus', refresh) }
  }, [])

  return <AuthContext.Provider value={{ user: session?.user || null, loading, restoreError, configured: authClient.configured, client: authClient }}>{children}</AuthContext.Provider>
}
