import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const serviceWorkerBuildVersion = `${Date.now().toString(36)}-${randomUUID()}`

function versionServiceWorker() {
  let isBuild = false
  return {
    name: 'version-service-worker',
    configResolved(config) { isBuild = config.command === 'build' },
    async closeBundle() {
      if (!isBuild) return
      const serviceWorkerPath = resolve(process.cwd(), 'dist/sw.js')
      const worker = await readFile(serviceWorkerPath, 'utf8')
      await writeFile(serviceWorkerPath, worker.replace('__BUILD_VERSION__', serviceWorkerBuildVersion))
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), versionServiceWorker()],
})
