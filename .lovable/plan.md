

# Audit & Nettoyage Complet des Doublons — Toutes Tables

## Résultat de l'audit (Lovable Cloud)

### Tables avec doublons confirmés

| Table | Doublons trouvés | Détail |
|-------|-----------------|--------|
| **categories** | 9 sous-catégories en double/triple | 2 jeux de parents (ancien `c1000000-*` du 23 fév + nouveau `a1000000-*` du 12 mars) + 3ème vague le 16 mars |
| **cities** | 6 villes en double | Ancien jeu (26 fév, sans `zone_id`) + nouveau jeu (12 mars, avec zones) |

### Tables propres (aucun doublon)

`affiliate_tiers` (5 — nettoyé), `customer_tiers` (7 — nettoyé), `logistic_zones`, `shipping_zones`, `shipping_defaults`, `shipping_routes`, `cms_banners`, `cms_homepage_sections`, `coupons`, `exchange_rates`

## Complexité : 5 produits référencent des catégories anciennes

Ces produits utilisent des IDs de l'ancien jeu et doivent être **réassignés** avant suppression :

```text
Produit                     Ancien ID (à supprimer)       → Nouveau ID (à garder)
─────────────────────────────────────────────────────────────────────────────────
Premium Congolese Fabric    c1000000-...-000001 (Women)   → a1000000-...-000001 (Fashion)
Minimalist Desk Lamp        6cc07902-... (Lighting/Home)  → f8c9f0f5-... (Lighting/Home&Living)
Running Sneakers            7b67fa6f-... (Shoes/Accessories) → 1f14de5f-... (Shoes/Fashion)
Gold Pendant Necklace       dac9fec9-... (Jewelry/Accessories) → 1b917aa7-... (Jewelry/Fashion)
Electric Kettle             6204a8ce-... (Kitchen/Home)   → 55e36a41-... (Kitchen/Home&Living)
```

## Plan d'implémentation

### Étape 1 — Réassigner les produits vers les bonnes catégories

Mettre à jour les 5 produits pour qu'ils pointent vers le nouveau jeu de catégories (sous `Fashion`, `Home & Living`, etc.).

### Étape 2 — Supprimer les sous-catégories en doublon

Supprimer les 9 sous-catégories dupliquées (ancien jeu `c1000000-*` parents + 3ème vague sans produits).

### Étape 3 — Supprimer les catégories parentes orphelines

Supprimer les 6 anciennes catégories parentes (`Women`, `Men`, `Kids`, `Electronics`, `Home`, `Accessories`) qui ne sont plus référencées.

### Étape 4 — Supprimer les villes en doublon

Supprimer les 6 anciennes villes (26 fév) qui n'ont pas de `zone_id` rattaché. Les nouvelles (12 mars) sont complètes avec zones.

### Étape 5 — SQL de production (Supabase.com)

Fournir le script SQL idempotent complet, prêt à coller dans le SQL Editor de la stack Vercel/Supabase.

### Sécurité

- Toutes les suppressions sont faites **après** réassignation des FK
- Le script vérifie l'existence avant de supprimer (`WHERE id IN (...)`)
- Aucune table de structure n'est modifiée (pas d'ALTER TABLE)
- Les anciennes villes n'ont aucune FK dans `orders.shipping_city` (c'est un champ texte, pas un UUID)

### Fichiers modifiés

| Cible | Action |
|-------|--------|
| Migration SQL (Lovable Cloud) | Réassignation produits + suppression doublons categories + cities |
| SQL fourni pour production | Même script, prêt pour Supabase.com SQL Editor |

