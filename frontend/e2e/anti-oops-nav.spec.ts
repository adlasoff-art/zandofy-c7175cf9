/**
 * Smoke: anti-Oups navigation (hooks / soft nav).
 * Run: npx playwright test e2e/anti-oops-nav.spec.ts (when e2e env configured)
 */
import { test, expect } from "@playwright/test";

test.describe("anti-Oups shell navigation", () => {
  test("home does not show Oups after soft navigations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Oups ! Un problème est survenu")).toHaveCount(0);
    // Soft navigate to search and back
    await page.goto("/search");
    await expect(page.getByText("Oups ! Un problème est survenu")).toHaveCount(0);
    await page.goto("/");
    await expect(page.getByText("Oups ! Un problème est survenu")).toHaveCount(0);
  });

  test("checkout soft entry without auth shows login, not Oups", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByText("Oups ! Un problème est survenu")).toHaveCount(0);
  });
});
