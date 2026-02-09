
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Ensure 'base' matches your GitHub repository name exactly.
  // If your repo is https://github.com/user/my-gym-app, base should be '/my-gym-app/'
  base: '/IronFlow/', 
  define: {
    // This allows us to use process.env.API_KEY in the browser
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
