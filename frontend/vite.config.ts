import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),  // Tailwind CSS v4 через Vite плагин
  ],
  resolve: {
    alias: {
      // Алиас @ для удобного импорта из src/
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',  // Нужно для Docker
    port: Number(process.env.PORT) || 5173,
    allowedHosts: true,  // Разрешаем любой хост (Cloudflare Tunnel, ngrok и т.д.)
    // Прокси /api → бэкенд (для локальной разработки без nginx)
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,  // проксируем WebSocket соединения тоже
      },
    },
  },
  // Явно включаем CommonJS пакеты в pre-bundling Vite
  optimizeDeps: {
    include: ['jspdf', 'html2canvas'],
  },
})
