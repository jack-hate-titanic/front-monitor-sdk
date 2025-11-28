import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 前端请求路径前缀：/api -> 转发到目标服务器
      '/api': 'http://localhost:3001' // 后端服务器地址（本地或线上均可）
    }
  }
})
