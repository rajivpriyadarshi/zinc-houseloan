import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        planner: resolve(__dirname, 'planner.html'),
        location: resolve(__dirname, 'location.html'),
        breakdown: resolve(__dirname, 'breakdown.html'),
        results: resolve(__dirname, 'results.html'),
        transition: resolve(__dirname, 'transition.html'),
        ping: resolve(__dirname, 'ping.html'),
      },
    },
  },
});
