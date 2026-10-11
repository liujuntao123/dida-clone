import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 后台管理与 API 同源部署：线上挂在 Worker 的 /admin 路径下；
// 本地 dev 经代理把 /api 转发到 wrangler dev（默认 3000，可用 DIDA_API_PROXY 覆盖）
const API_TARGET = process.env.DIDA_API_PROXY ?? 'http://127.0.0.1:3000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/admin/',
  server: {
    port: 5174,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
})
