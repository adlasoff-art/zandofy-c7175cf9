# Déploiement — preuves de paiement (RLS Storage)

Migrations :

- [`20260523120000_payment_proof_storage_rls.sql`](../supabase/migrations/20260523120000_payment_proof_storage_rls.sql) — RLS Storage (upload preuve)
- [`20260524120000_off_platform_dual_validation.sql`](../supabase/migrations/20260524120000_off_platform_dual_validation.sql) — colonnes double validation vendeur/admin

## Ordre recommandé

1. `20260523120000_payment_proof_storage_rls.sql` (RLS Storage)
2. `20260524120000_off_platform_dual_validation.sql` (colonnes orders)

Si vous avez appliqué **dual validation avant RLS**, ce n’est pas bloquant : les deux migrations sont indépendantes. Relancez simplement le fichier RLS (voir ci-dessous).

## Erreur « policy already exists » (42710)

Cela signifie que les policies Storage existent déjà (première exécution partielle ou double lancement).

**Option A — Vérifier puis ignorer** (si les 8 policies sont présentes) :

```sql
SELECT policyname
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname IN (
    'Customers upload payment proofs',
    'Customers read own payment proofs',
    'Customers update own payment proofs',
    'Store team read payment proofs on store orders',
    'Store team upload hub proofs',
    'Store team read hub proofs on store orders',
    'Store team update hub proofs on store orders',
    'Customers read own hub proofs'
  )
ORDER BY policyname;
```

Résultat attendu : **8 lignes** sur staging et prod → RLS Storage OK, pas besoin de réexécuter.

**Option B — Réexécuter sans erreur** : le fichier `20260523120000_...` dans le repo utilise désormais `DROP POLICY IF EXISTS` puis `CREATE POLICY`. Recoller **tout** le fichier dans le SQL Editor et Run (staging puis prod). Cela remplace les policies par la version du repo (sans toucher aux autres policies du bucket).

## Déploiement

1. **Staging** — migrations SQL ci-dessus + checklist smoke sur `studio-staging.zandofy.com`.
2. **Production** — même chose, fenêtre faible trafic.
3. Déployer le frontend `develop` après les migrations SQL (UI vendeur + admin).

## Checklist smoke staging

- [ ] Client : commande `off_platform` → dashboard → upload JPG preuve → pas d’erreur RLS.
- [ ] Client : aperçu de la preuve visible après upload (URL signée).
- [ ] Vendeur : voit la commande hors plateforme + preuve → « Valider la preuve client » (reste `awaiting_payment`).
- [ ] Admin : onglet « Hors plateforme » → « Libérer la commande » → statut `pending` + expédition payée.
- [ ] Non-régression : commande carte en `awaiting_payment` invisible chez le vendeur.
- [ ] Client : `DeferredPaymentModal` — preuve frais expédition ou last mile.
- [ ] Sécurité : autre utilisateur ne peut pas uploader sur `payment-proofs/{order_id}/...` d’autrui.
- [ ] Non-régression : livreur — upload chemin `{user_id}/...` toujours OK.
- [ ] Vendeur : upload photo hub (`hub-proofs/{order_id}/...`).

## Rollback (si besoin)

```sql
DROP POLICY IF EXISTS "Customers upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Customers read own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Customers update own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Store team read payment proofs on store orders" ON storage.objects;
DROP POLICY IF EXISTS "Store team upload hub proofs" ON storage.objects;
DROP POLICY IF EXISTS "Store team read hub proofs on store orders" ON storage.objects;
DROP POLICY IF EXISTS "Store team update hub proofs on store orders" ON storage.objects;
DROP POLICY IF EXISTS "Customers read own hub proofs" ON storage.objects;
```

## Monitoring 24h (production)

- Logs Supabase → Storage → erreurs 403 sur bucket `delivery-proofs`.
- Tickets support « preuve paiement » / « row-level security ».

## Sémantique champs `orders` (hors plateforme)

| Contexte | Colonne | Statut typique |
|----------|---------|----------------|
| Preuve paiement **produit** hors plateforme | `shipping_payment_proof_url` | `awaiting_payment` |
| Preuve frais **expédition** | `shipping_payment_proof_url` | `deferred` / après expédition |
| Preuve **last mile** | `last_mile_payment_proof_url` | — |
| Photo **hub** vendeur | `hub_pickup_proof_url` | — |

Voir aussi [`docs/OFF_PLATFORM_PAYMENT.md`](OFF_PLATFORM_PAYMENT.md).
