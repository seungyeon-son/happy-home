import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 개발 시 백엔드(3000)로 API 프록시
    proxy: { '/api': 'http://localhost:3000' },
  },
});
