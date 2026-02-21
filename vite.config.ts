import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Using './' makes the build portable for GitHub Pages regardless of the repo name
  base: './', 
  define: {
    // This allows us to use process.env.API_KEY and GEMINI_API_KEY in the browser
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY)
  },
  build: {
    minify: 'esbuild',
    sourcemap: false
  }
});