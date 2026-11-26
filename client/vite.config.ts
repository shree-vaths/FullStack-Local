import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The dev server proxies /api to the Express server, so the browser sees one
 * origin: no CORS setup, and the client code uses relative URLs (/api/...)
 * that keep working unchanged when the app is deployed behind one domain.
 */
const API_TARGET = process.env.API_URL ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': API_TARGET },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
