import { test, expect } from "@playwright/test";

/**
 * Smoke test — vérifie que la home charge et que le layout principal est rendu.
 * Sert de "canary" pour garantir que la base URL Playwright est joignable.
 */
test("home page loads", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  // Static index.html title; rejects Lovable gate ("Login" / "Internal Lovable project")
  await expect(page).toHaveTitle(/Zandofy/i);
  // Proves React app mounted (not only index.html shell)
  await expect(page.locator("header")).toBeVisible({ timeout: 20_000 });
  // Homepage H1 is sr-only — use DOM locator, not getByRole (hidden from a11y tree)
  await expect(page.locator("main h1, h1.sr-only").first()).toBeAttached({ timeout: 20_000 });
});