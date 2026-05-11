# Audit Cohérence Plateforme : Langue / Thème / Devise

## Objectif

Rendre la plateforme entièrement cohérente en **FR** et **EN**, en thème **clair** et **sombre**, avec la **devise** choisie appliquée partout — **sans toucher à la logique métier** et **sans dégrader les performances**.

---

## Garantie n°1 — Sécurité métier (non-négociable)

Périmètres **JAMAIS** modifiés :
- **Paiements** : `keccel-cardpay`, `kelpay-webhook`, `subscribe-payment`, payload Keccel (SAFETY §7).
- **Pricing engine** : 45% markup, 10% commission, gateway fees, `formatPrice()` (signature inchangée).
- **Checkout** : split par `store_id`, déduction points, livraison, COD rider.
- **RLS / DB / migrations / schémas** : zéro modif.
- **Edge Functions** : zéro modif (sauf phase 3 e-mails optionnelle, re-soumise séparément).
- **Auth, RBAC, impersonation, logistique, statuts commande, dual-code, opérateurs, forwarders** : intouchés.
- **Secrets, env vars, Docker, Vercel, GitHub Actions** : intouchés.

Chaque PR est **purement présentationnelle** : remplacement de littéraux par `t("key")`, remplacement de `bg-white`/`text-gray-*` par tokens sémantiques, appel à `formatPrice()`. Aucun changement de signature, d'effet, de routage, de mutation, ni d'ajout de dépendance npm.

Garde-fous :
- Clés i18n **additives uniquement** (jamais renommer/supprimer une clé existante).
- Fallback FR systématique : `t("key") || "Texte FR"`.
- Prix toujours via `formatPrice()` du contexte.
- Tokens HSL remplacent uniquement les neutres (`white`/`black`/`gray-*`), jamais les couleurs sémantiques (`primary`, `sale`, `destructive`, `certified`).

---

## Garantie n°2 — Performance (zéro régression)

Cible : **aucune dégradation** de LCP, TBT, taille bundle, requêtes réseau, mémoire JS.

### Pourquoi cette refonte n'impacte pas les perfs

1. **Pas de re-render supplémentaire** : `useI18n()` est déjà monté dans `App.tsx` et consommé via Context. Remplacer une string littérale par `t("key")` est une **lookup O(1)** sur un objet JS en mémoire — coût négligeable (< 0.01 ms par appel).
2. **Pas de chargement asynchrone des traductions** : les ~462 clés FR + EN actuelles sont déjà **inlined dans `I18nContext.tsx`** (1356 lignes, ~80 KB minifié). Ajouter ~150-200 clés portera le contexte à ~95 KB minifié, soit **+15 KB sur le bundle initial** — sera compressé à ~3 KB gzip. Acceptable.
3. **Pas de nouvelle requête réseau** : ajouter `name_fr` dans un `.select("id, name, name_fr, ...")` Supabase n'ajoute **aucun round-trip** et coûte ~10-20 bytes par produit (déjà indexé).
4. **Pas de re-mount des composants** : le changement de locale via `setLocale` déclenche un re-render normal de l'arbre React, identique au comportement actuel.
5. **Tokens CSS** : remplacer `bg-white` par `bg-card` est un **simple changement de classe Tailwind**. Aucun impact runtime, aucun JS exécuté, juste du CSS statique.
6. **Pas de polyfill, pas de lib i18next** : on reste sur le système maison léger déjà en place. Aucune dépendance ajoutée.

### Optimisations prises en compte

- **Lazy splitting EN si bundle dépasse 110 KB** : si après ajout des clés Phase 1 le `I18nContext.tsx` minifié dépasse 110 KB, on extraira les traductions dans deux fichiers `translations.fr.ts` / `translations.en.ts` chargés dynamiquement via `import()` (lazy par locale). **Seulement si nécessaire** — vérifié au build après chaque PR.
- **Pas de fonction `t()` recréée à chaque render** : le `t` exposé par le contexte est déjà mémoisé. On ne touche pas à ça.
- **Pas de boucle de fallback coûteuse** : `t("key") || "fallback"` est court-circuit JS, négligeable.
- **`name_fr` ajouté UNE seule fois** par requête, jamais en double. Vérification systématique avant chaque PR.
- **Pas de transformation côté client lourde** : pas de map/sort/filter ajouté en plus, juste un ternaire `locale === "fr" ? x.name_fr ?? x.name : x.name`.
- **Service Worker / cache** : aucun changement de stratégie cache. Le SW continue de servir le bundle compilé.

### Mesures avant/après (obligatoires)

Avant de merger chaque PR Phase 1 :
1. `bun run build` → comparer la taille du chunk principal avant/après (delta attendu < +5 KB gzip par PR).
2. `browser--performance_profile` sur `/` en staging → comparer LCP, TBT, JS heap. Delta toléré : ≤ 5%.
3. Vérifier Network tab : aucune requête supplémentaire vers Supabase.
4. Smoke Playwright `checkout-multi-origin.spec.ts` doit passer avec un temps total équivalent (±10%).

Si une métrique régresse > 5%, **rollback de la PR** et investigation avant de continuer.

---

## État des lieux (audit rapide déjà effectué)

- **Langue** : 44 fichiers / 406 utilisent `useI18n()` → 89% des écrans ont du FR codé en dur (Header, MegaMenu, Footer, HeroBanner, CartDrawer, Checkout, drawers, toasts).
- **Données BDD multilingues** : `name_fr` existe, utilisé dans 7 fichiers seulement.
- **Thème** : `bg-white`/`text-gray-*`/`text-black` confirmés dans `HeroBanner`, `FeaturedSidebar`, `AdminAutomationsTab`, `SeoSerpPreview`, `BlogTab`, `AdminSettingsPage`.
- **Devise** : `formatPrice()` centralisé, ~30 fichiers manipulent des prix, à vérifier exhaustivement.

---

## Plan en 3 phases (validation séparée)

### Phase 0 — Rapport d'audit (zéro modif de code)

Livrable : `docs/AUDIT-I18N-THEME-CURRENCY.md` listant :
1. FR hardcodé par fichier (JSX, `aria-label`, `title`, `placeholder`, `alt`, `toast`, mocks).
2. Couleurs non-tokenisées (`bg-white`, `text-black`, `bg/text/border-gray-*`, hex inline).
3. Prix sans `formatPrice()` ou symbole codé.

Classement : **Critique** (parcours acheteur) → **Haute** (Vendor/Operator) → **Moyenne** (Admin) → **Basse** (e-mails/PDF).

Coût perf : **zéro** (rapport Markdown).

### Phase 1 — Parcours acheteur public

Périmètre : `Header`, `MegaMenu`, `Footer`, `HeroBanner`, `CategoryBanner`, `RecommendationsSection`, `ProductCard`, `ProductGrid`, `PredictiveSearch`, `CartDrawer`, `CompareBar`, pages `Index/Category/Product/Search/Cart/Checkout/Account/Orders/Wishlist/Compare/Stores/Tracking/Auth`.

Découpée en **4-5 mini-PR** pour rollback facile :
1. Header + MegaMenu + Footer
2. HeroBanner + Home (Recommendations, CategoryBanner)
3. ProductCard + ProductGrid + Category + Product + Search + PredictiveSearch
4. Cart + Checkout
5. Account + Orders + Tracking + Wishlist + Compare

Pour chaque PR : build size check + perf profile + smoke test avant merge.

### Phase 2 — Vendor / Operator / Forwarder / Rider

Re-soumise après Phase 1 stabilisée.

### Phase 3 — Admin + e-mails/PDF (optionnelle)

Re-soumise séparément (touche aux edge functions e-mail/facture, nécessitera audit Keccel/SAFETY distinct).

---

## Détails techniques (dev)

Patterns appliqués :
```tsx
// i18n
const { locale, t, formatPrice } = useI18n();
const displayName = locale === "fr" ? (item.name_fr ?? item.name) : item.name;

// Tokens
bg-white       → bg-card | bg-background
text-black     → text-foreground
text-gray-500  → text-muted-foreground
bg-gray-50/100 → bg-muted
border-gray-*  → border-border

// Prix
{formatPrice(amount)}   // jamais `$${amount}` ni toLocaleString ad hoc
```

Charge estimée :
- Phase 0 : ~30 min, rapport seul.
- Phase 1 : 4-5 PR, 150-200 clés, 25-30 fichiers, ~3-4 h.
- Phase 2 : 3-4 PR.

PWA versionning (SAFETY §6) : à la fin de Phase 1, demande de bump **minor** (1.x.0) + broadcast push aux 678 PWA installées.

---

## Approbation demandée

Démarrer **Phase 0 uniquement** : génération du rapport `docs/AUDIT-I18N-THEME-CURRENCY.md`. **Zéro modification de code, zéro impact perf, zéro impact métier.** Les Phases 1/2/3 seront re-soumises pour approbation périmètre par périmètre après lecture du rapport, avec mesure perf systématique avant chaque merge.
