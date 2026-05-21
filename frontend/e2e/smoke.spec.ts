import { test, expect } from "@playwright/test";

/**
 * Smoke — static shell + React hydration (home marketplace layout).
 * CI: build with frontend/.env.e2e or GitHub VITE_* secrets.
 */
test("home page loads", async ({ page }) => {
  const jsErrors: string[] = [];
  page.on("pageerror", (err) => jsErrors.push(err.message));

  const response = await page.goto("/", { waitUntil: "load" });
  expect(response?.status()).toBeLessThan(400);

  await expect(page).toHaveTitle(/Zandofy/i);

  // Production bundle (not dev index.html → /src/main.tsx)
  await expect(page.locator('script[type="module"][src*="/assets/"]')).toHaveCount(1);

  // React must mount (GeoBlockGuard no longer returns null while bootstrap loads)
  await page.waitForFunction(
    () => (document.getElementById("root")?.childElementCount ?? 0) > 0,
    { timeout: 60_000 },
  );

  await expect(page.locator("header")).toBeVisible({ timeout: 30_000 });

  if (jsErrors.length > 0) {
    console.warn("Smoke page errors:", jsErrors);
  }
});
