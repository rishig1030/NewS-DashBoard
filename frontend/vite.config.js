// Vite = the tool that runs our React app in the browser while we develop.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Plugins teach Vite about React (.jsx files) and Tailwind CSS
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,

    // While developing, any request starting with /api is secretly forwarded
    // to our backend. This way React and the backend look like ONE website,
    // and the browser never complains about CORS.
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
});