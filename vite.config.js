import { defineConfig } from "vite";
import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  build: mode === "library" ? {
    outDir: "dist/package",
    lib: {
      entry: resolve(import.meta.dirname, "src/index.js"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["vue", "vue-konva", "konva", "@lucide/vue", "perfect-freehand"],
    },
  } : {
    outDir: "dist/demo",
  },
}));
