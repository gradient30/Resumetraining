import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site at /Resumetraining/, so assets must be relative to that path.
  // Local dev (npm run dev) still works at /.
  base: '/Resumetraining/',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
