import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }
          if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('/react/')) {
            return 'react-vendor';
          }
          if (id.includes('lucide-react')) {
            return 'ui-vendor';
          }
          if (id.includes('simple-peer')) {
            return 'meeting-vendor';
          }
          if (id.includes('@emailjs')) {
            return 'email-vendor';
          }
        }
      }
    }
  },
  define: {
    global: 'window', // Fix for simple-peer and other node-based libraries
    'process.env': {}
  }
})
