import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5174, allowedHosts: ['localhost', '127.0.0.1'], proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } } },
  preview: { allowedHosts: ['localhost', '127.0.0.1'], port: 5174 },
  build: { outDir: 'dist', sourcemap: false },
});
