import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// MSW mocks exist only in `--mode mock` (npm run dev:mock and Playwright). In every other
// mode the service worker folder is not served and the mock code is dead-code eliminated,
// so nothing from src/mocks or mock-public reaches dist/.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  publicDir: mode === 'mock' ? 'mock-public' : false,
  server: {
    port: 5173,
    proxy: mode === 'mock' ? undefined : {
      // 127.0.0.1, not localhost: Node 17+ on Windows resolves localhost to ::1 (IPv6) first,
      // but uvicorn listens on IPv4 only, which gives ECONNREFUSED ::1:10000.
      '/api': { target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:10000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020',
  },
}));
