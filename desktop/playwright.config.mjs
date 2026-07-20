import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:1420", browserName: "chromium", headless: true },
  webServer: { command: "npm run web:dev", port: 1420, reuseExistingServer: !process.env.CI },
});
