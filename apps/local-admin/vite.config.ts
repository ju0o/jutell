import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.BB_LOCAL_ADMIN_VITE_PORT ?? 5174),
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:' + (process.env.BB_LOCAL_ADMIN_PORT ?? '8787'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
});
