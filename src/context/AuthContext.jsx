import { useEffect, useRef, useState } from 'react'
import { AuthContext } from './authContext.js'
import { authClient } from '../services/auth.js'
import { ensureStudyRoadmap, parseProgressBackup, readProgressSnapshot, setStorageUser, writeProgressSnapshot } from '../utils/storage.js'
import { createProgressSync } from '../services/progressSync.js'

const INITIAL_SYNC = { status: 'loading', ready: false, updatedAt: null }

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(() => authClient.configured && authClient.hasStoredSession())
  const [restoreError, setRestoreError] = useState(false)
  const [syncState, setSyncState] = useState(INITIAL_SYNC)
  const [progressVersion, setProgressVersion] = useState(0)
  const [adminState, setAdminState] = useState({ userId: null, isAdmin: false, loading: false, error: null })
  const syncRef = useRef(null)
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) {
      setAdminState({ userId: null, isAdmin: false, loading: false, error: null })
      return undefined
    }
    let active = true
    const refresh = () => authClient.checkAdmin().then(isAdmin => {
      if (active) setAdminState({ userId, isAdmin, loading: false, error: null })
    }).catch(error => {
      if (active) setAdminState({ userId, isAdmin: false, loading: false, error })
    })
    setAdminState({ userId, isAdmin: false, loading: true, error: null })
    refresh()
    const timer = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [userId])

  useEffect(() => {
    let active = true
    const unsubscribe = authClient.subscribe((next) => {
      if (syncRef.current?.userId !== next?.user.id) syncRef.current?.stop()
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

  useEffect(() => {
    if (!userId) return undefined
    const baselineKey = `${authClient.storageKey}:sync-base:${encodeURIComponent(userId)}`
    const prefix = `n3vjit_account:${encodeURIComponent(userId)}:`
    const controller = createProgressSync({
      client: { loadProgress: () => authClient.loadProgress(userId), saveProgress: (data, stamp) => authClient.saveProgress(data, stamp, userId) },
      readLocal: () => readProgressSnapshot(userId),
      writeLocal: data => writeProgressSnapshot(data, userId, { notify: false }),
      loadBase: () => {
        try {
          const cached = JSON.parse(localStorage.getItem(baselineKey) || 'null')
          if (!cached || typeof cached !== 'object' || Array.isArray(cached)) return null
          if (Object.keys(cached).length) parseProgressBackup(JSON.stringify(cached))
          return cached
        } catch { return null }
      },
      saveBase: data => localStorage.setItem(baselineKey, JSON.stringify(data)),
      withLock: task => navigator.locks ? navigator.locks.request(`n3vjit-sync:${userId}`, task) : task(),
      onState: next => setSyncState({ ...next, userId }),
      onRemoteApplied: () => { setProgressVersion(value => value + 1); window.dispatchEvent(new Event('n3vjit:progress')) },
    })
    syncRef.current = { ...controller, userId }
    const localChanged = event => { if (event.detail?.userId === userId && event.detail.key !== 'n3vjit_theme') controller.changed() }
    const storageChanged = event => { if (event.key === null || event.key?.startsWith(prefix)) { setProgressVersion(value => value + 1); controller.changed() } }
    const refresh = () => { if (!document.hidden) controller.syncNow() }
    const flush = () => controller.syncNow()
    const poll = setInterval(refresh, 60000)
    window.addEventListener('n3vjit:progress-write', localChanged)
    window.addEventListener('storage', storageChanged)
    window.addEventListener('online', flush)
    window.addEventListener('focus', refresh)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    controller.syncNow()
    return () => {
      controller.stop(); syncRef.current = null; clearInterval(poll)
      window.removeEventListener('n3vjit:progress-write', localChanged)
      window.removeEventListener('storage', storageChanged)
      window.removeEventListener('online', flush)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [userId])

  const sync = syncState.userId === userId ? syncState : INITIAL_SYNC
  const admin = adminState.userId === userId ? adminState : { userId, isAdmin: false, loading: Boolean(userId), error: null }
  const loginAt = session?.user.last_sign_in_at
  useEffect(() => {
    if (userId && sync.ready) {
      try { ensureStudyRoadmap(loginAt) } catch { /* Progress sync still reports storage failures; the date form allows retrying. */ }
    }
  }, [userId, loginAt, sync.ready, progressVersion])
  return <AuthContext.Provider value={{ user: session?.user || null, loading, restoreError, configured: authClient.configured, client: authClient, sync, syncNow: () => syncRef.current?.syncNow(), progressVersion, isAdmin: admin.isAdmin, adminLoading: admin.loading, adminError: admin.error }}>{children}</AuthContext.Provider>
}
