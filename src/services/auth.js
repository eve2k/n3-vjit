import { createAuthClient } from './authClient.js'

const env = import.meta.env || {}
let storage
try { storage = globalThis.localStorage } catch { /* Guest mode remains available. */ }

export const authClient = createAuthClient({
  url: env.VITE_SUPABASE_URL,
  publicKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY,
  storage,
})
