import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative URLs so the app works from a sub-path such as https://user.github.io/recipe-log/
  base: './',
  plugins: [react()],
})
