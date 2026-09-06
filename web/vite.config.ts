import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind IPv4 loopback explicitly. This server previously came up on
    // [::1] only, so curl (which resolves localhost to ::1) worked while
    // the browser — which tries 127.0.0.1 first — got connection refused.
    // 127.0.0.1 rather than 0.0.0.0 so the dev server is not published to
    // the local network.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
