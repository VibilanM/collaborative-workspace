import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

function getBackendMode(): string {
  try {
    const backendEnvPath = path.resolve(import.meta.dirname, '../backend/.env')
    if (fs.existsSync(backendEnvPath)) {
      const content = fs.readFileSync(backendEnvPath, 'utf-8')
      const match = content.match(/^MODE\s*=\s*([^\r\n#]+)/m)
      if (match) {
        return match[1].trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch (err) {
    console.warn('Could not read backend .env:', err)
  }
  return 'DEV'
}

// https://vite.dev/config/
export default defineConfig(() => {
  const backendMode = getBackendMode()

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_BACKEND_MODE': JSON.stringify(backendMode),
    },
  }
})

