import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("uses OmniDesk names for local environment entrypoints", () => {
  const viteConfig = fs.readFileSync(path.join(desktopRoot, "vite.config.js"), "utf8");
  const environment = fs.readFileSync(path.join(desktopRoot, "..", "docs/ENVIRONMENT.md"), "utf8");
  assert.match(viteConfig, /process\.env\.OMNIDESK_EMBEDDED_BROWSER === "1"/);
  assert.match(viteConfig, /process\.env\.PROJECT_OS_EMBEDDED_BROWSER === "1"/);
  assert.match(environment, /OMNIDESK_EMBEDDED_BROWSER/);
});

test("uses OmniDesk identity for the native package metadata and active run records", () => {
  const cargo = fs.readFileSync(path.join(desktopRoot, "src-tauri/Cargo.toml"), "utf8");
  const workbench = fs.readFileSync(path.join(desktopRoot, "src/main.jsx"), "utf8");
  assert.match(cargo, /authors = \["OmniDesk"\]/);
  assert.equal(cargo.includes('authors = ["Project OS"]'), false);
  assert.match(workbench, /清理策略由 OmniDesk Runtime 维护/);
  assert.equal(workbench.includes("清理策略由 Project OS 配置维护"), false);
});
