import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The backend's FRONTEND_URL defaults to this port, so fail instead of silently moving.
    port: 5173,
    strictPort: true,
    // Same-origin /api in development, matching the Vercel rewrite in production, so the auth
    // cookie is always first-party.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
