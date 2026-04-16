

# Fix Google Search Console — Breadcrumb Structured Data

## Problem

Google requires every `ListItem` in a `BreadcrumbList` to have a non-empty `name` property. Two issues in `buildBreadcrumbJsonLd`:

1. **Missing `name` guard**: If `product.categoryFr` or any field is `undefined`/`null`, the JSON-LD emits `"name": null` which Google rejects.
2. **Last item missing `item`**: Google expects `item` (URL) on every `ListItem` including the last one. The current code does include it, but the URL could be malformed if the name is undefined (e.g., `/category/undefined`).

## Fix

### 1. `buildBreadcrumbJsonLd` in `SEOHead.tsx`

- Filter out any breadcrumb items where `name` is falsy before building the JSON-LD
- Ensure `name` always falls back to a non-empty string
- Keep `item` (URL) on every entry

```typescript
export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  const validItems = items.filter(i => i.name && i.name.trim());
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: validItems.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}
```

### 2. Callers — defensive fallbacks

- **ProductPage.tsx**: `name: product.categoryFr || "Produit"` and `name: product.nameFr || "Produit"`
- **CategoryPage.tsx**: `name: category.name_fr || category.name || slug` and parent fallback

## Files modified

| File | Change |
|------|--------|
| `frontend/src/components/SEOHead.tsx` | Filter empty names in `buildBreadcrumbJsonLd` |
| `frontend/src/pages/ProductPage.tsx` | Fallback strings for breadcrumb names |
| `frontend/src/pages/CategoryPage.tsx` | Fallback strings for breadcrumb names |

## Risk

Minimal. Read-only change to JSON-LD output. No DB, no migration, no new dependencies.

