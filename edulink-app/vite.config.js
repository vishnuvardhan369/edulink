import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env': 'globalThis.process.env'
  },
  server: {
    port: 5173,
    host: true
  }
})
