import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        planner: resolve(__dirname, 'planner.html'),
        location: resolve(__dirname, 'location.html'),
        results: resolve(__dirname, 'results.html'),
      },
    },
  },
});
