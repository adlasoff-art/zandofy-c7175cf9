import { defineConfig, devices } from "@playwright/test";

/**
 * Configuration Playwright — Zandofy E2E
 *
 * - Tests dans `e2e/`
 * - Base URL configurable via PLAYWRIGHT_BASE_URL (défaut : preview Lovable).
 * - Lance `bun run dev` automatiquement si on cible localhost:8080.
 */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  "https://id-preview--65f34701-6c01-4696-9427-e259d5eefd46.lovable.app";

const isLocal = baseURL.includes("localhost");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60 * 1000,
  expect: { timeout: 10 * 1000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: isLocal
    ? {
        command: "bun run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120 * 1000,
      }
    : undefined,
});