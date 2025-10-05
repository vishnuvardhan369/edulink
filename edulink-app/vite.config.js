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
    host: '0.0.0.0', // Allow access from network devices
    cors: true,
    // Enable history API fallback for client-side routing
    historyApiFallback: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Ensure proper asset handling for GitHub Pages
    rollupOptions: {
      output: {
        manualChunks: undefined,
      }
    }
  },
  base: './', // Use relative paths for assets
  // Configure for GitHub Pages deployment
  publicDir: 'public'
})
