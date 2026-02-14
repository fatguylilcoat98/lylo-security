import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Set base to './' to ensure relative paths work for HashRouter on Render
  base: './',

  build: {
    // Ensures the output directory is 'dist' for Render deployment
    outDir: 'dist',
    // Generates source maps for easier debugging if a deployment crash occurs
    sourcemap: true,
  },

  preview: {
    host: true,
    port: 4173,
    // Allows Render to access the preview host during build checks
    allowedHosts: true
  },

  server: {
    host: true,
    // Ensures internal development port matches standard expectations
    port: 5173,
    strictPort: true,
  }
})
