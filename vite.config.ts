import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Using './' makes the build portable for GitHub Pages / Netlify regardless of the repo name
  base: './', 
  define: {
    // This allows us to use process.env.API_KEY in the browser
    // We provide a fallback empty string to prevent "undefined" string injection
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    // Providing a basic process.env object prevents crashes in libraries that expect it
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'production')
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'recharts', 'lucide-react', '@google/genai'],
        },
      },
    },
  },
});