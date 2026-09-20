# Zandofy Flutter — Internationalisation (FR / EN)

> Source unique web : `frontend/src/contexts/I18nContext.tsx` (~**1 426 clés** par locale, ~2 852 entrées totales fr+en).
> **Locale par défaut** : `fr`. **Secondaire** : `en`.

---

## 1. Architecture web (à reproduire)

### 1.1 Provider

```typescript
export type Locale = "fr" | "en";
export type CurrencyCode = "USD" | "EUR" | "XAF" | "CDF" | "NGN" | "GBP" | "CNY";
```

- Stockage : `localStorage` clés `zandofy_locale`, `zandofy_currency`.
- Hook : `useI18n()` → `{ locale, currency, setLocale, setCurrency, t, formatPrice, currencySymbol }`.

### 1.2 Fonction `t(key, params?)`

1. Cherche override CMS : `cmsOverrides[locale][key]` (depuis `platform_settings.key = 'cms_texts'`).
2. Sinon `translations[locale][key]`.
3. Fallback `translations.fr[key]`.
4. Sinon retourne la clé brute.
5. Interpolation : `{{name}}`, `{{count}}`, etc. (regex `\{\{(\w+)\}\}`).

**Exemple** :
```dart
t('dashboard.welcomeMobile', {'name': 'Marie'})
// FR: "Bienvenue, Marie"
```

### 1.3 `formatPrice(usdPrice: number)`

- Prix DB en **USD**.
- Multiplie par taux devise active.
- **XAF, CDF, NGN, CNY** : entier + symbole (`FCFA`, `FC`, `₦`, `¥`).
- **USD, EUR, GBP** : symbole + 2 décimales.

Taux par défaut (`DEFAULT_CURRENCIES` dans I18nContext) :

| Code | Symbole | Label | Taux vs USD |
|------|---------|-------|-------------|
| USD | $ | US Dollar | 1 |
| EUR | € | Euro | 0.92 |
| XAF | FCFA | Franc CFA | 605 |
| CDF | FC | Franc Congolais | 2800 |
| NGN | ₦ | Naira | 1550 |
| GBP | £ | British Pound | 0.79 |
| CNY | ¥ | Yuan | 7.24 |

Flutter : charger taux depuis `platform_settings` (comme le web) avec fallback ci-dessus.

---

## 2. Stratégie Flutter recommandée

### Option A — `flutter_gen` + ARB (recommandée)

1. Générer ARB depuis `I18nContext.tsx` (script one-shot) ou importer sections ci-dessous.
2. `l10n.yaml` :
```yaml
arb-dir: lib/l10n
template-arb-file: app_fr.arb
output-localization-file: app_localizations.dart
nullable-getter: false
```
3. `MaterialApp` :
```dart
localizationsDelegates: AppLocalizations.localizationsDelegates,
supportedLocales: AppLocalizations.supportedLocales,
locale: Locale('fr'), // défaut
```

### Option B — Map JSON embarquée (parité rapide)

- Exporter `translations.fr` / `translations.en` en JSON depuis le TS.
- `EasyLocalization` ou service custom identique au `t()` web.

### Nommage ARB

Convertir clés pointées → underscores ARB (Flutter convention) :

| Clé web | Clé ARB |
|---------|---------|
| `header.search` | `headerSearch` |
| `checkout.orderConfirmed` | `checkoutOrderConfirmed` |
| `dashboard.welcomeMobile` | `dashboardWelcomeMobile` |

Ou garder les points si `flutter_intl` configuré avec `use-escaping: true` et clés quoted — **préférer underscores** pour tooling Dart.

---

## 3. Préfixes de clés — **scope app client Flutter**

Clés **à inclure** (navigation, catalogue, panier, checkout, compte). Clés **à exclure** (admin, vendor, operator, forwarder) sauf si écran « devenir vendeur » exclu de V1.

### 3.1 Navigation & chrome

| Préfixe | Exemples | FR |
|---------|----------|-----|
| `header.*` | search, cart, wishlist, account | Rechercher, Panier, Favoris |
| `bottomNav.*` | home, search, wishlist, cart | Accueil, Recherche |
| `topbar.*` | freeShipping, freeReturns | Livraison Gratuite… |
| `nav.*` | categories, sales, viewAll | Catégories, Soldes |
| `megaMenu.*` | viewAll | Tout voir |
| `switcher.*` | language, currency, theme | Langue, Devise |

### 3.2 Catalogue & produit

| Préfixe | Usage |
|---------|-------|
| `product.*` | PDP, add to cart, wishlist, not found |
| `search.*` | Filtres, tri, empty state |
| `stores.*` | Liste boutiques |
| `compare.*` | Comparateur (V2) |
| `wishlist.*` | Liste favoris |

**Exemples `product.*`** :
- `product.addToCart` → « Ajouter au panier » / « Add to cart »
- `product.notFound` → « Produit introuvable » / « Product not found »
- `product.similarItems` → « Articles similaires »

### 3.3 Panier & checkout

| Préfixe | Usage |
|---------|-------|
| `cart.*` | Drawer panier |
| `checkout.*` | Wizard commande (~40+ clés) |

**Exemples `checkout.*`** :
- `checkout.loginRequired` / `checkout.loginRequiredDesc`
- `checkout.emptyCart` / `checkout.emptyCartDesc`
- `checkout.placeOrder` → « Confirmer la commande »
- `checkout.orderConfirmed` → « Commande confirmée ! »
- `checkout.invalidCode`, `checkout.expiredCode`, `checkout.usedCode`
- `checkout.requiredField`, `checkout.fillRequired`

### 3.4 Authentification

| Préfixe | Usage |
|---------|-------|
| `auth.*` | Login, signup, forgot, Google |

**Exemples** :
- `auth.login` → « Connexion »
- `auth.signup` → « Créer un compte »
- `auth.continueGoogle` → « Continuer avec Google »
- `auth.signupSuccess` / `auth.signupSuccessDesc`

### 3.5 Compte & dashboard

| Préfixe | Usage |
|---------|-------|
| `dashboard.*` | Onglets, commandes, KPI |
| `dashboard.tab.*` | overview, orders, tracking… |
| `dashboard.detail.*` | Détail commande |
| `account.*` | Hub compte `/account` |

### 3.6 Fidélité, KYC, notifications (V2)

| Préfixe | Usage |
|---------|-------|
| `loyalty.*` | Programme fidélité |
| `kyc.*` | Bannières vérification |
| `push.prompt.*` | Permission notifications |
| `subscription.*` | Abonnements livraison |

### 3.7 Litiges, retours, fret (dashboard)

| Préfixe | Usage |
|---------|-------|
| `intl.timeline.*` | Suivi international |
| `freight.panel.*` | Détails fret |
| `dispute.*` | Litiges (si présent) |
| `returns.*` | Retours |

### 3.8 Footer & pages statiques

| Préfixe | Usage |
|---------|-------|
| `footer.*` | Liens pied de page |
| `about.*` | À propos |
| `faq.*` | FAQ |
| `help.*` | Centre d'aide |

### 3.9 Préfixes **hors scope** app client (ne pas traduire en V1)

`admin.*`, `vendor.*`, `operator.*`, `forwarder.*`, `rider.*`, `cms.admin.*`, modération, analytics admin.

---

## 4. Fichier ARB exemple (`app_fr.arb`)

```json
{
  "@@locale": "fr",
  "headerSearch": "Rechercher",
  "headerCart": "Panier",
  "headerWishlist": "Favoris",
  "headerAccount": "Compte",
  "bottomNavHome": "Accueil",
  "bottomNavSearch": "Recherche",
  "bottomNavWishlist": "Favoris",
  "bottomNavCart": "Panier",
  "productAddToCart": "Ajouter au panier",
  "productNotFound": "Produit introuvable",
  "cartEmpty": "Votre panier est vide",
  "cartCheckout": "Commander",
  "checkoutLoginRequired": "Connexion requise",
  "checkoutLoginRequiredDesc": "Connectez-vous pour continuer votre commande.",
  "checkoutOrderConfirmed": "Commande confirmée !",
  "authLogin": "Connexion",
  "authSignup": "Créer un compte",
  "wishlistEmpty": "Votre liste est vide pour le moment",
  "searchNoResults": "Aucun produit trouvé",
  "dashboardTabOrders": "Commandes",
  "switcherLanguage": "Langue",
  "switcherCurrency": "Devise"
}
```

`app_en.arb` — mêmes clés, valeurs EN depuis bloc `en:` dans I18nContext.

### Pluriels & paramètres ARB

Web utilise `{{count}}` et logique manuelle. En ARB :

```json
"dashboardOrdersCount": "{count, plural, =1{{count} commande} other{{count} commandes}}",
"@dashboardOrdersCount": {
  "placeholders": {
    "count": { "type": "int" }
  }
}
```

Équivalent web : `dashboard.orders.count` / `dashboard.orders.countPlural`.

---

## 5. Contenu bilingue **hors** clés `t()`

Données DB avec champs parallèles :

| Entité | Champ EN | Champ FR | Règle affichage |
|--------|----------|----------|-----------------|
| `products` | `name` | `name_fr` | `locale == fr` → `name_fr` |
| `categories` | `name` | `name_fr` | idem |
| `stores` | `name` | — | souvent unique |
| `trend_tags` | `name` | `name_fr` | idem |
| CMS pages | sections EN | sections FR | `PrivacyPage`, `TermsPage` |

Pattern web (`ProductCard`) :
```typescript
locale === "fr" ? product.nameFr : product.name
```

Flutter :
```dart
String productTitle(Product p, Locale l) =>
  l.languageCode == 'fr' ? p.nameFr : p.name;
```

---

## 6. Overrides CMS dynamiques

`platform_settings` → `cms_texts` :

```json
{
  "fr": { "topbar.freeShipping": "Texte custom…", … },
  "en": { … }
}
```

Le web fusionne au runtime dans `cmsOverrides`. Flutter V1 : ignorer ou charger au bootstrap (`usePlatformBootstrap`) et merger dans le service i18n.

---

## 7. Dates & nombres

Web : `date-fns` avec locale `fr` ou `enUS` selon `locale`.

Flutter :
- `intl` package
- `DateFormat.yMMMd('fr_FR')` vs `'en_US'`
- Dashboard commandes : `dd/MM/yyyy` FR, `en-US` format EN

---

## 8. Sélecteur langue UI

Web : modal « Langue & Devise » (`switcher.*`).

Flutter :
- Écran paramètres ou bottom sheet
- Liste `LOCALES` : FR 🇫🇷, EN 🇬🇧
- Persistance `SharedPreferences` : `zandofy_locale`, `zandofy_currency`
- Rebuild `MaterialApp` locale

---

## 9. Extraction complète des clés (workflow)

Pour générer tous les ARB depuis le repo :

```bash
# Depuis la racine du monorepo (à créer si besoin)
node scripts/export-i18n-from-context.mjs
# Lit frontend/src/contexts/I18nContext.tsx
# Écrit lib/l10n/app_fr.arb + app_en.arb
```

**Source de vérité** : tant que le web n’a pas migré vers JSON externes, synchroniser Flutter après chaque gros changement de `I18nContext.tsx`.

---

## 10. Checklist i18n Flutter

- [ ] `fr` locale par défaut (`MaterialApp.locale`)
- [ ] Toutes les chaînes UI via `AppLocalizations` (pas de texte hardcodé FR)
- [ ] `formatPrice` aligné web (USD base + taux)
- [ ] Titres produits/catégories selon locale DB
- [ ] Interpolation `{{name}}` testée
- [ ] Erreurs auth/checkout depuis clés documentées §3
- [ ] Accessibilité : `Semantics` avec même libellés que `aria-label` web
- [ ] CMS overrides (optionnel V1.1)

---

## 11. Référence rapide — messages erreur client (FR)

| Clé web | Texte FR |
|---------|----------|
| `auth.error` | Erreur |
| `checkout.invalidCode` | (titre code invalide) |
| `checkout.fillRequired` | Veuillez remplir tous les champs obligatoires. |
| `wishlist.loginRequired` | Connectez-vous pour voir vos favoris |
| — (CartContext) | Connectez-vous pour ajouter au panier. |
| — (WishlistContext) | Impossible d'ajouter aux favoris |
| — (AuthPage) | Service indisponible |
| — (AuthPage) | Mot de passe trop faible |

Les entrées sans clé `t()` explicite sont des chaînes **hardcodées** dans les contexts/pages — dupliquer en ARB côté Flutter pour parité.

---

## 12. Fichier source

Chemin complet : `frontend/src/contexts/I18nContext.tsx`

Structure :
```typescript
const translations: Record<Locale, Record<string, string>> = {
  fr: { "key": "valeur", … },
  en: { "key": "value", … },
};
```

Pour audit : rechercher `"prefix.` dans ce fichier pour lister toutes les clés d'un domaine.
