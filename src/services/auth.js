import { createAuthClient } from './authClient.js'

const env = import.meta.env || {}
let storage
let oauthStorage
try { storage = globalThis.localStorage } catch { /* Guest mode remains available. */ }
try { oauthStorage = globalThis.sessionStorage } catch { /* Explain unavailable browser storage on Google sign-in. */ }

export const authClient = createAuthClient({
  url: env.VITE_SUPABASE_URL,
  publicKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY,
  storage,
  oauthStorage,
})
