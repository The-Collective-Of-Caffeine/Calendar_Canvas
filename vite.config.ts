import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";

const sourceRoot = process.env.CALENDAR_CANVAS_SOURCE_ROOT;

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    fs: {
      allow: sourceRoot
        ? [searchForWorkspaceRoot(process.cwd()), sourceRoot]
        : [searchForWorkspaceRoot(process.cwd())]
    }
  }
});
