

## Plan : Corriger l'erreur "vendor_off_platform_enabled not in schema cache"

### Diagnostic

- La colonne `vendor_off_platform_enabled` **existe** dans la base de données (vérifié par requête SQL directe).
- La migration qui l'ajoute (`20260328204639`) se trouve dans `supabase/migrations/` (racine) mais **pas** dans `frontend/supabase/migrations/` qui est le répertoire source de vérité pour Lovable Cloud.
- Le cache de schéma PostgREST n'a pas été rafraîchi après l'ajout de cette colonne.

### Solution

Créer une migration dans `frontend/supabase/migrations/` qui ajoute la colonne de manière idempotente. Cela forcera un rechargement du cache PostgREST.

**Fichier** : `frontend/supabase/migrations/<new>_add_vendor_off_platform_enabled.sql`

```sql
ALTER TABLE public.vendor_pricing_overrides
  ADD COLUMN IF NOT EXISTS vendor_off_platform_enabled boolean NOT NULL DEFAULT false;
```

C'est une migration d'une seule ligne, idempotente — si la colonne existe déjà, elle ne fait rien. L'exécution de la migration rafraîchira le schema cache PostgREST et l'erreur disparaîtra.

### Aucun changement de code frontend nécessaire

Les requêtes existantes dans `CheckoutPage.tsx` et `AdminVendorPricingPage.tsx` utilisent déjà `(supabase as any)` pour contourner le typage strict — elles fonctionneront dès que le cache sera rafraîchi.

