import { test, expect } from "@playwright/test";

/**
 * Smoke test — vérifie que la home charge et que le layout principal est rendu.
 * Sert de "canary" pour garantir que la base URL Playwright est joignable.
 */
test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Zandofy/i);
});