import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Forward API calls to the Express backend. The browser only ever talks to localhost:5173,
    // so the login cookie is same-origin and no CORS setup is needed in development.
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
