

# Combo box recherchable — Catégorie & Fournisseur (formulaire produit vendeur)

## Objectif
Remplacer les `<select>` natifs **Catégorie** et **Fournisseur** dans le formulaire d'ajout/édition produit (`VendorProductManager.tsx`) par un combo box avec **champ de recherche intégré**, identique au comportement déjà utilisé pour les champs géographiques (`GeoCombobox`).

## Approche

Le projet a déjà un composant éprouvé : `frontend/src/components/address/GeoCombobox.tsx` (recherche, mobile fullscreen, desktop dropdown, accessibilité). On va **généraliser ce pattern** en créant un composant réutilisable.

### 1. Nouveau composant : `frontend/src/components/ui/SearchableCombobox.tsx`
Copie/adaptation de `GeoCombobox` avec :
- API générique : `options: { value, label, sublabel?, imageUrl? }[]`
- Support optionnel d'une **vignette image** à gauche de chaque ligne (utile pour fournisseurs avec `product_image_url`)
- Support optionnel d'un **sublabel** (ex: nom de plateforme du fournisseur)
- Placeholder, label, disabled, allowClear
- Recherche insensible à la casse + accents tolérés via `.normalize("NFD").replace(/\p{Diacritic}/gu, "")`

### 2. Intégration dans `VendorProductManager.tsx`

**Champ Catégorie** (lignes 697-709) :
```tsx
<SearchableCombobox
  label="Catégorie"
  placeholder="— Aucune —"
  value={form.category_id}
  onChange={(v) => setForm({ ...form, category_id: v })}
  options={categories.map(c => ({ value: c.id, label: c.name_fr }))}
/>
```

**Champ Fournisseur** (lignes 723-753) — conserve la logique de chargement des `supplier_products` au changement :
```tsx
<SearchableCombobox
  label="🏭 Fournisseur"
  placeholder="— Aucun —"
  value={form.supplier_id}
  onChange={(v) => {
    setForm({ ...form, supplier_id: v, supplier_product_id: "" });
    /* idem fetch supplier_products */
  }}
  options={suppliers.map(s => ({
    value: s.id,
    label: s.agent_name,
    sublabel: s.platform_name || undefined,
    imageUrl: s.product_image_url || undefined,
  }))}
/>
```

Le bloc « vignette aperçu » et « Produit du fournisseur » (lignes 754-…) restent inchangés.

### 3. Bonus cohérence
Le champ **Tag Tendance** (lignes 710-722) sera aussi migré vers `SearchableCombobox` (même pattern, gain UX gratuit, peu de tags mais cohérence visuelle).

## Fichiers modifiés
- ➕ `frontend/src/components/ui/SearchableCombobox.tsx` (nouveau, ~110 lignes)
- ✏️ `frontend/src/components/VendorProductManager.tsx` (3 remplacements de `<select>`)

## Hors scope
- Pas de changement DB, pas d'Edge Function, pas de migration.
- Pas de modification du combo `GeoCombobox` existant (stable, utilisé ailleurs).
- Pas d'ajout de pagination/virtualization (listes < 500 items dans 99% des cas, suffisant).

## Détails techniques
- Mobile : plein écran avec `<input>` `font-size: 16px` (anti-zoom iOS), `position: fixed`, `safe-area-inset-top`, body scroll lock — strictement aligné sur `GeoCombobox`.
- Desktop : dropdown positionné en `fixed` (évite le clipping par les conteneurs `overflow-hidden` du formulaire produit).
- Accessibilité : autoFocus sur l'input de recherche à l'ouverture, fermeture sur clic extérieur (desktop) et bouton X (mobile).
- i18n : libellés via `t("...")` (clés `combobox.search`, `combobox.no_results`) ajoutés à `I18nContext.tsx` (FR/EN) — conforme à la mémoire `centralized-i18n-refactor-logic`.

