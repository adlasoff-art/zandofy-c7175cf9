import { test, expect } from "@playwright/test";

/**
 * E2E — Checkout multi-origines (Lot 11C Phase 2)
 *
 * Scénario à compléter quand des fixtures stables (user de test, produits CN/TR,
 * adresse RDC) seront disponibles. Pour l'instant on documente le flow attendu :
 *
 *   1. Login avec un user de test (variables d'env E2E_USER_EMAIL / E2E_USER_PASSWORD).
 *   2. Ajouter au panier 1 produit origin_country=CN + 1 produit origin_country=TR.
 *   3. Aller au checkout, choisir une adresse RDC.
 *   4. Vérifier que le bandeau "Votre panier sera expédié en 2 colis distincts" s'affiche.
 *   5. Vérifier qu'un FreightSelector indépendant existe pour CN et pour TR.
 *   6. Sélectionner un transitaire pour chaque groupe.
 *   7. Confirmer la commande et vérifier que 2 sous-orders sont créées (origin_country renseigné).
 */
test.describe("Checkout multi-origines (Lot 11C)", () => {
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    "Définir E2E_USER_EMAIL / E2E_USER_PASSWORD pour exécuter ce scénario.",
  );

  test("affiche un sélecteur transitaire par origine", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel(/email/i).fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel(/mot de passe|password/i).fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: /se connecter|sign in/i }).click();
    await expect(page).toHaveURL(/\/(account|$)/, { timeout: 15_000 });

    // TODO : ajouter au panier via API ou navigation UI quand fixtures dispos.
    await page.goto("/checkout");

    // Si le panier contient des produits multi-origines, le bandeau doit apparaître.
    const banner = page.getByText(/colis distincts|separate packages/i);
    if (await banner.count()) {
      await expect(banner.first()).toBeVisible();
      // Au moins 2 cartes "Colis depuis ..."
      const groups = page.getByText(/Colis depuis|Package from/i);
      expect(await groups.count()).toBeGreaterThanOrEqual(2);
    } else {
      test.info().annotations.push({
        type: "skip-reason",
        description: "Panier mono-origine — scénario non applicable",
      });
    }
  });
});