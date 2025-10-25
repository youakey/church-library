import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/church-library/', // <= имя вашего репозитория на GitHub
})
