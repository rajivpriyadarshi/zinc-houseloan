import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        ["index", "planner", "location", "cost-breakdown", "results"].map(
          (page) => [
            page,
            fileURLToPath(new URL(`./${page}.html`, import.meta.url)),
          ],
        ),
      ),
    },
  },
});
