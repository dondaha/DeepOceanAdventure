import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: 'localhost',
    port: 3000 // 你可以选择一个不同的端口
  },
  plugins: [
    vue(),
    vueDevTools(),
  ],
  build: {
    outDir: 'DeepOceanAdventure',
  },
  base: '/DeepOceanAdventure/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./public', import.meta.url))
    },
  },
})
