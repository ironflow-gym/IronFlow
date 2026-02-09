import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Using './' makes the build portable for GitHub Pages regardless of the repo name
  base: './', 
  define: {
    // This allows us to use process.env.API_KEY in the browser
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});