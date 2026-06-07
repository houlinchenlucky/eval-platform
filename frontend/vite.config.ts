import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 前端跑在 3000 端口；/api 代理到后端 8000，省去跨域烦恼
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
