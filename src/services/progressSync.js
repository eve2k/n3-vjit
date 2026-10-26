import { reconcileProgress, sameProgress } from '../utils/syncProgress.js'

// One coordinator per signed-in user. Dependencies are injected for deterministic tests.
export function createProgressSync({ client, readLocal, writeLocal, loadBase, saveBase, onState = () => {}, onRemoteApplied = () => {}, withLock = task => task(), schedule = setTimeout, cancel = clearTimeout }) {
  let stopped = false
  let running = null
  let timer = null
  let again = false
  let backoff = 5000
  let state = { status: 'loading', updatedAt: null, ready: false }
  const emit = next => { if (!stopped) { state = { ...state, ...next }; onState(state) } }
  const later = delay => {
    if (stopped) return
    cancel(timer)
    timer = schedule(() => { timer = null; syncNow() }, delay)
  }
  async function perform() {
    if (stopped) return
    emit({ status: 'saving' })
    for (let attempt = 0; attempt < 3 && !stopped; attempt++) {
      const remote = await client.loadProgress()
      if (stopped) return
      const local = readLocal()
      const base = loadBase()
      const merged = reconcileProgress(base, local, remote?.data || {})
      if (!sameProgress(merged, local)) {
        writeLocal(merged)
        onRemoteApplied()
      }
      if (sameProgress(merged, remote?.data || {})) {
        saveBase(merged)
        backoff = 5000
        emit({ status: 'synced', updatedAt: remote?.updated_at || null, ready: true })
        return
      }
      try {
        const saved = await client.saveProgress(merged, remote?.updated_at || null)
        if (stopped) return
        saveBase(merged)
        backoff = 5000
        const pending = !sameProgress(readLocal(), merged)
        emit({ status: pending ? 'pending' : 'synced', updatedAt: saved.updated_at, ready: true })
        if (pending) again = true
        return
      } catch (failure) {
        // Unique constraint on the first insert and optimistic PATCH conflicts both rebase.
        if (failure.status !== 409 || attempt === 2) throw failure
      }
    }
  }
  function syncNow() {
    if (stopped) return Promise.resolve()
    cancel(timer); timer = null
    if (running) { again = true; return running }
    let failed = false
    running = (async () => {
      try { await withLock(perform) }
      catch (failure) {
        failed = true
        emit({ status: failure.code === 'network_error' ? 'offline' : 'error', ready: true })
        later(backoff)
        backoff = Math.min(backoff * 2, 60000)
      }
    })().finally(() => {
      running = null
      if (again && !stopped && !failed) later(0)
      again = false
    })
    return running
  }
  return {
    syncNow,
    changed() { if (!stopped) { emit({ status: 'pending' }); later(800) } },
    stop() { stopped = true; cancel(timer) },
  }
}
