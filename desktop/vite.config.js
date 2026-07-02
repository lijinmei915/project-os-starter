import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const previewFiles = new Map([
  ["/.project-os/desktop-provider.json", path.join(rootDir, ".project-os/desktop-provider.json")],
  ["/.project-os/model-catalog.json", path.join(rootDir, ".project-os/model-catalog.json")],
]);

function projectOsPreviewFiles() {
  return {
    name: "project-os-preview-files",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const filePath = previewFiles.get(req.url || "");
        if (!filePath) {
          next();
          return;
        }
        fs.readFile(filePath, "utf8", (err, content) => {
          if (err) {
            res.statusCode = 404;
            res.end("{}");
            return;
          }
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(content);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), projectOsPreviewFiles()],
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
