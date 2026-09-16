import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? process.env.PAGES_BASE_PATH || '/khmer-calendar-manager/' : '/',
  define: { 'import.meta.env.VITE_STORAGE': JSON.stringify(mode === 'pages' ? 'browser' : 'server') },
  server: { host: '127.0.0.1', allowedHosts: ['localhost'], fs: { strict: true } },
  build: { outDir: mode === 'pages' ? 'dist-pages' : 'dist' },
}));
