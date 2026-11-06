import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // only libraries that do not depend on React get their own file: splitting React, Clerk and i18next apart made the
        // files import each other in a circle and the page crashed at start (Cannot access 'x' before initialization)
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('leaflet')) return 'map';
          if (/[\/](chart.js|@kurkle)[\/]/.test(id)) return 'charts';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
});
