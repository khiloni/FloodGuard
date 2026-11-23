import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// The MSW service worker lives in mock-public/ and is served only by the dev server in
// `--mode mock` (npm run dev:mock and Playwright). It is never copied into dist/.
function mockWorker(): Plugin {
  return {
    name: 'floodguard-mock-worker',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/mockServiceWorker.js', (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(readFileSync(new URL('./mock-public/mockServiceWorker.js', import.meta.url)));
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'mock' ? [mockWorker()] : [])],
  publicDir: 'public', // icons, favicon, web manifest
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
