import { test, expect } from "@playwright/test";

/**
 * Smoke test — home loads with React shell (not only static index.html).
 * CI builds with VITE_* via secrets or frontend/.env.e2e fallbacks.
 */
test("home page loads", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/", { waitUntil: "load" });

  await expect(page).toHaveTitle(/Zandofy/i);

  // GeoBlockGuard + platform bootstrap can delay first paint
  await expect(page.locator("header")).toBeVisible({ timeout: 45_000 });

  await expect(page.locator("main h1, h1.sr-only").first()).toBeAttached();

  if (errors.length > 0) {
    console.warn("Page errors during smoke:", errors);
  }
});
