import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/flashcards/',
  plugins: [react()],
  server: {
    proxy: {
      '/flashcards/api': 'http://127.0.0.1:8001',
    },
  },
})

