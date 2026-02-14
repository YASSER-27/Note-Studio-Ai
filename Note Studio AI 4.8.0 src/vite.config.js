import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './', // <--- أضف هذا السطر هنا (مهم جداً للـ exe)
  plugins: [react()],
  optimizeDeps: {
    // استثناء Monaco من التحسين التلقائي لمنع ضياع ملفات الـ Worker
    exclude: ['monaco-editor']
  },
  build: {
    commonjsOptions: {
      // لضمان توافق المكتبات التي تعتمد على CommonJS داخل Electron
      transformMixedEsModules: true,
    },
  },
})