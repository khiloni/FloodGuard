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
      '/api': { target: 'http://localhost:10000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020',
  },
}));
