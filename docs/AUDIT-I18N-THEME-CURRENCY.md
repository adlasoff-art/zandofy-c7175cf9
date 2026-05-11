# Audit Cohérence Plateforme — i18n / Thème / Devise

Date: 2026-05-11  
Périmètre: `frontend/src/components` + `frontend/src/pages`  
Méthode: scan regex multi-pass (sous-estimation possible des littéraux FR — voir §Méthodologie).  
**Zéro modification de code dans ce livrable.**

---

## 1. Synthèse chiffrée

| Signal | Occurrences | Fichiers touchés |
|---|---|---|
| Littéraux FR (dictionnaire restreint `>Mot...`) | 317 matches | ~70 fichiers |
| Classes Tailwind non-tokenisées (`bg-white`, `text-black`, `text-gray-*`, etc.) | 68 matches | ~40 fichiers |
| Prix non formatés via `formatPrice()` (`${...price}`, `.toFixed(2)`) | 284 matches | ~60 fichiers |
| Fichiers utilisant `useI18n()` | 44 / ~406 composants | 11% |
| Fichiers utilisant `formatPrice()` | 5 fichiers seulement | (insuffisant) |

> Le ratio `useI18n` (11%) confirme que la majorité des écrans contiennent du FR codé en dur. Le ratio `formatPrice` est encore plus bas : la devise n'est appliquée correctement que sur une fraction des écrans.

---

## 2. Top fichiers — Littéraux FR hardcodés

(Triés par densité, dictionnaire restreint — la vraie liste est plus large)

### Critique — parcours acheteur public
- `src/pages/CheckoutPage.tsx` (4 + 19 prix) — **prioritaire P1**
- `src/pages/StorePage.tsx` (4)
- `src/pages/HelpCenterPage.tsx` (4)
- `src/components/MegaMenu.tsx` (déjà observé : "Tout voir", "Aucune sous-catégorie")
- `src/components/HeroBanner.tsx` (cf. §3, couleurs aussi)

### Haute — Vendor / Operator / Forwarder / Rider
- `src/pages/DashboardPage.tsx` (11)
- `src/pages/ShipperDashboardPage.tsx` (5)
- `src/pages/RiderDashboardPage.tsx` (4)
- `src/pages/forwarder/ForwarderDashboardPage.tsx` (3)
- `src/components/vendor/VendorAnalyticsProTab.tsx` (4)

### Moyenne — Admin
- `src/pages/admin/AdminShippingPage.tsx` (10)
- `src/pages/admin/AdminLogisticsPage.tsx` (8)
- `src/components/admin/UserDetailDrawer.tsx` (8)
- `src/pages/admin/AdminFeaturedPlacementsPage.tsx` (6)
- `src/components/admin/cms/BlogTab.tsx` (6)
- Plus ~15 autres pages `admin/*` à 3–5 matches chacune.

### Basse — emails, PDF, edge functions
- Non scanné dans ce passage (touche `supabase/functions/*` → audit séparé requis pour Phase 3).

---

## 3. Top fichiers — Couleurs non-tokenisées

### Critique
- `src/components/HeroBanner.tsx` — **12 occurrences** (`bg-white`, `text-black`, `text-gray-*`). Visible sur la home → impact direct dark mode.
- `src/components/ui/{sheet,drawer,dialog,alert-dialog}.tsx` — 1 chacun. À vérifier (souvent c'est le `bg-background` overlay légitime, mais parfois `bg-white` brut).

### Haute
- `src/components/vendor/OrderTransitionModals.tsx` (6)
- `src/pages/VendorDashboardPage.tsx` (3)
- `src/components/vendor/VendorOrderManager.tsx` (1)
- `src/components/payments/{Shipping,Retry,Deferred}PaymentModal.tsx` (1 chacun)

### Moyenne — Admin
- `src/components/admin/ColorPaletteEditor.tsx` (3) — légitime (éditeur de palette, couleurs littérales attendues).
- `src/pages/admin/AdminCategoriesPage.tsx` (2)
- `src/pages/admin/AdminLogisticsPage.tsx` (2)
- `src/components/admin/seo/SeoSerpPreview.tsx` (1) — légitime (preview Google SERP, doit rester blanc).
- ~10 autres admin pages à 1 match chacune.

### Basse / faux positifs probables
- `ColorPaletteEditor.tsx`, `SeoSerpPreview.tsx` : couleurs littérales **voulues** (preview Google, picker palette). **À exclure du refactor.**

---

## 4. Top fichiers — Prix sans `formatPrice()`

### Critique
- `src/pages/CheckoutPage.tsx` (19) — **bloquant pour cohérence devise sur le tunnel achat**
- `src/pages/ProductPage.tsx` (8)
- `src/pages/CategoryPage.tsx` (3)
- `src/components/VariantOrderDrawer.tsx` (7)
- `src/components/checkout/FreightSelector.tsx` (12)
- `src/components/checkout/FreightSummary.tsx` (4)
- `src/components/DynamicShippingCalculator.tsx` (6)
- `src/components/PrecisionShippingEstimate.tsx` (4)
- `src/components/CheckoutShippingCalculator.tsx` (4)
- `src/components/bundles/BundleSection.tsx` (4)

### Haute — Vendor / Operator
- `src/components/vendor/VendorOrderManager.tsx` (7)
- `src/components/vendor/VendorWalletTab.tsx` (7)
- `src/components/vendor/PricingCalculator.tsx` (7) — calculs internes (faux positif probable, à confirmer)
- `src/pages/RiderDashboardPage.tsx` (7)
- `src/pages/operator/OperatorBillingPage.tsx` (6)
- `src/components/forwarder/ForwarderHandoffsPanel.tsx` (5)

### Moyenne — Admin
- `src/pages/admin/AdminVendorAccountingPage.tsx` (13)
- `src/pages/admin/AdminOrdersPage.tsx` (13)
- `src/pages/admin/AdminShippingPage.tsx` (9)
- `src/pages/admin/AdminPointsPage.tsx` (6)
- `src/components/admin/dashboard/OverviewTab.tsx` (8)
- `src/components/admin/dashboard/VendorsTab.tsx` (5)

> ⚠️ Certains `.toFixed(2)` sont des **calculs internes** (coefficients, pourcentages, marges, distances km, kg) et **ne doivent PAS** passer par `formatPrice()`. Filtrage à faire fichier par fichier en Phase 1.

---

## 5. Classement par criticité (lots PR)

### Phase 1 — Parcours acheteur public (critique)
| Lot PR | Fichiers | Charge | Risque |
|---|---|---|---|
| 1.1 Header / MegaMenu / Footer | 3 fichiers | ~30 min | Très faible |
| 1.2 Home (HeroBanner + Recommendations + CategoryBanner) | ~5 fichiers | ~45 min | Faible (Hero: 12 couleurs) |
| 1.3 ProductCard / ProductGrid / Category / Product / Search / PredictiveSearch | ~8 fichiers | ~1h | Faible |
| 1.4 Cart / Checkout + FreightSelector / FreightSummary / Shipping calculators | ~7 fichiers | ~1h30 | Moyen (19 prix Checkout) |
| 1.5 Account / Orders / Tracking / Wishlist / Compare / Stores | ~8 fichiers | ~45 min | Faible |
| **Total Phase 1** | **~30 fichiers** | **~4 h** | **Faible–Moyen** |

### Phase 2 — Vendor / Operator / Forwarder / Rider (haute)
~25 fichiers, ~3 PR, ~3 h.

### Phase 3 — Admin + emails (moyenne / basse)
~35 fichiers admin + audit edge functions (`generate-invoice`, `send-vendor-email`, `notify-order-status`, `process-vendor-analytics-emails`). À re-soumettre séparément (touche e-mails Keccel/SAFETY).

---

## 6. Risques métier identifiés (à NE PAS toucher)

- `formatPrice()` signature et logique de conversion devises : **inchangée**.
- `PricingCalculator.tsx`, `pricing-utils.ts`, `last-mile-fee.ts` : `.toFixed(2)` internes (markup 45%, commission 10%, fees gateway) → **logique métier, jamais via `formatPrice()`**.
- `ColorPaletteEditor.tsx`, `SeoSerpPreview.tsx` : couleurs hardcodées **voulues**.
- `keccel-cardpay`, `kelpay-webhook`, `subscribe-payment` : edge functions paiement → **hors périmètre Phase 1/2**.
- Emails / PDF (invoices, labels) : Phase 3 distincte, requiert audit SAFETY/Keccel.

---

## 7. Méthodologie

- Regex FR : dictionnaire restreint (`Tout|Aucun|Voir|Ajouter|...`) appliqué uniquement sur `>Mot` (JSX text). **Ne capture pas** : `aria-label`, `title`, `placeholder`, `alt`, toasts (`toast({ title: "..." })`), strings dans `if/return`, mocks. → La vraie volumétrie FR est probablement **2–3× supérieure** (~600–900 matches réels). Phase 1 fera un scan élargi par fichier ciblé.
- Regex couleurs : couvre `bg-white`, `bg-black`, `text-white`, `text-black`, `text-gray-N`, `bg-gray-N`, `border-gray-N`, `bg-slate-N`, `text-slate-N`. **Ne couvre pas** les `style={{ color: "#fff" }}` inline ni les CSS modules.
- Regex prix : `${...price...}`, `.toFixed(2)`. **Ne couvre pas** `Intl.NumberFormat` ad-hoc ni `+ " USD"`. Filtrage faux positifs (calculs internes) requis fichier par fichier.

---

## 8. Recommandation pour Phase 1

Démarrer par le **lot 1.1 (Header / MegaMenu / Footer)** :
- Risque minimal (3 fichiers présentationnels).
- Validation rapide du pattern (`t("key") || "FR"`, tokens sémantiques).
- Mesure perf (delta bundle, LCP, TBT) sur un petit lot avant de scaler.

Si lot 1.1 valide les garanties perf (< +5 KB gzip, ≤ 5% LCP/TBT), enchaîner lot 1.2 → 1.5.

---

## 9. Livrable Phase 0

✅ Ce document.  
✅ Zéro modification code.  
✅ Zéro impact perf.  
✅ Zéro impact métier.

**Prochaine action en attente d'approbation** : lancer **lot 1.1 Phase 1** (Header + MegaMenu + Footer).