import { defineConfig, devices } from "@playwright/test";

/**
 * Configuration Playwright — Zandofy E2E
 *
 * - Tests dans `e2e/`
 * - CI : build local + `vite preview` sur http://127.0.0.1:5173 (voir e2e-playwright.yml)
 * - Local : PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 après `bun run build && bun run preview`
 * - Override : PLAYWRIGHT_BASE_URL pour cibler staging/prod
 */
const LOCAL_PREVIEW = "http://127.0.0.1:5173";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || LOCAL_PREVIEW;

const isLocalPreview = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(baseURL);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60 * 1000,
  expect: { timeout: 15 * 1000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: isLocalPreview
    ? {
        command: process.env.CI ? "bun run preview" : "bun run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      }
    : undefined,
});
