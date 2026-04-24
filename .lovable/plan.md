

# Plan Lot 3F — Hardening sécurité non-cassant

**Objectif** : Corriger les findings critiques/moyens **sans rien casser** côté affichage public produits/boutiques. Stack cible : Supabase prod perso (`vpt...yxf`). Toutes les migrations seront fournies en SQL téléchargeable.

---

## Findings traités & stratégie

### ✅ 3F.1 — `stores` : exposition champs sensibles (Critique)

**Constat** : la table `stores` est lisible par tous (`USING true`). Cela expose :
- `whatsapp_number` (PII) → ne doit être révélé qu'au moment du clic sur le bouton WhatsApp pour un utilisateur **connecté**
- `banned_by`, `banned_at`, `suspended_by` → 100% interne staff
- `max_products_limit` → quota interne

**À conserver public** (utilisé par StorePage/ProductPage/VendorProfileCard) :
- `is_banned`, `is_suspended` (le public a le droit de savoir qu'une boutique est inactive)
- `suspension_reason`, `ban_reason` → tu as précisé que le motif **ne** doit pas être public. Donc on les masque côté public mais on les laisse au propriétaire + staff.
- `*_override` (sales, followers, verified_years, review_count) → utilisés par les badges publics

**Solution** :
1. Créer une vue `stores_public` (security_invoker=on) exposant uniquement les colonnes publiques (sans `whatsapp_number`, `ban_reason`, `suspension_reason`, `banned_by`, `banned_at`, `suspended_by`, `max_products_limit`)
2. Remplacer la policy SELECT publique sur `stores` par une policy restreinte :
   - **Public anonyme** : redirigé vers la vue (la policy directe sur `stores` interdit l'accès anon)
   - **Authentifié** : peut lire `stores` complet **sauf** champs internes (via la vue ou colonnes filtrées)
   - **Owner / collaborateurs / staff** : accès total à `stores`
3. Edge Function `get_store_whatsapp` (verify_jwt=true) → retourne le `whatsapp_number` uniquement à un utilisateur authentifié au moment du clic
4. Front : 
   - `StorePage`, `VendorProfileCard`, `ProductPage`, `services/api.ts` : pointer vers `stores_public` pour les lectures publiques
   - Bouton WhatsApp : appel à l'Edge Function au clic (au lieu de pré-charger le numéro)
   - `VendorDashboardPage`, hooks staff/owner : continuent d'interroger `stores` directement

### ✅ 3F.2 — `automation_user_progress` : énumération anonyme (Moyen)

**Constat** : `(user_id IS NULL AND anon_id IS NOT NULL)` permet à n'importe qui de lire la progression d'autrui en devinant un `anon_id`.

**Solution non-cassante** :
- Conserver l'INSERT anonyme (nécessaire pour tracker les workflows J0)
- Restreindre le SELECT anonyme : retirer la policy actuelle, la remplacer par `USING (false)` côté anonyme
- Pour les besoins de progression côté client anonyme, le hook `use-automation.ts` ne lit que pour insérer/mettre à jour → on bascule la lecture vers une RPC `get_my_anon_progress(p_anon_id text)` qui valide l'anon_id contre un cookie httpOnly côté Edge Function (ou simplement supprimer la lecture anonyme si non strictement nécessaire — à valider avec le hook)

### ✅ 3F.3 — `forwarders` : emails/téléphones publics (Critique latent)

**Solution** : créer vue `forwarders_public` excluant `contact_email` et `contact_phone` ; restreindre le SELECT public sur `forwarders` aux colonnes safe via la vue.

### ✅ 3F.4 — `error_reports` : `user_email` insertable anonyme (Critique)

**Solution** : supprimer l'écriture client de `user_email` ; dériver server-side via trigger `BEFORE INSERT` qui force `user_email = (SELECT email FROM profiles WHERE id = auth.uid())` ou NULL si anon.

### ✅ 3F.5 — `vendor_customer_reviews` : client ne lit pas ses avis (Moyen)

**Solution** : ajouter policy SELECT `USING (customer_id = auth.uid())`.

### ✅ 3F.6 — RLS Policy Always True (1 warning linter)

**Solution** : identifier la policy UPDATE/DELETE/INSERT avec `true` (probablement une policy historique) et la restreindre à `auth.uid() IS NOT NULL` ou owner-scoped.

### ⚠️ 3F.7 — Buckets storage publics avec listing (5 warnings linter)

**Décision** : les **fichiers** restent publics (produits, logos, bannières). On bloque uniquement le **listing** (énumération) en retirant la policy `SELECT *` sur `storage.objects` pour les buckets concernés et en la remplaçant par une policy plus stricte qui autorise la lecture par chemin direct mais pas le listing du bucket.

**⚠️ Test obligatoire** sur preview avant prod : vérifier que les `<img src="https://.../bucket/file.jpg">` continuent de s'afficher. Si un seul affichage casse → rollback immédiat.

---

## Livrables

### Migrations SQL (téléchargeables, à exécuter sur Supabase prod perso)

1. `lot3f_01_stores_hardening.sql` — vue `stores_public`, restriction RLS sur `stores`
2. `lot3f_02_forwarders_hardening.sql` — vue `forwarders_public`
3. `lot3f_03_error_reports_user_email.sql` — trigger server-side
4. `lot3f_04_vendor_reviews_customer_read.sql` — policy SELECT customer
5. `lot3f_05_automation_anon_lockdown.sql` — restriction lecture anonyme
6. `lot3f_06_always_true_policy_fix.sql` — fix policy permissive identifiée
7. `lot3f_07_storage_listing_lockdown.sql` — anti-listing buckets (à valider d'abord en preview)

### Edge Function

- `get_store_whatsapp` (verify_jwt=true) : retourne `whatsapp_number` pour un store_id donné si l'appelant est authentifié

### Code frontend (lectures + bouton WhatsApp)

- `frontend/src/pages/StorePage.tsx` — lecture sur `stores_public` + bouton WhatsApp via Edge Function
- `frontend/src/components/VendorProfileCard.tsx` — bouton WhatsApp via Edge Function  
- `frontend/src/services/api.ts` — `PRODUCT_SELECT` : retirer `whatsapp_number`, lire via `stores_public` join
- `frontend/src/hooks/use-automation.ts` — adapter à la nouvelle policy anon

---

## Détail technique (réservé aux devs)

**Pattern de coexistence vue + table** :
```sql
CREATE VIEW public.stores_public WITH (security_invoker=on) AS
  SELECT id, name, slug, logo_url, banner_url, country, city, address,
         is_verified, is_certified, verified_years, verified_years_override,
         is_online, last_seen_at, presence_visible, sales_count, sales_override,
         followers_count, followers_override, products_count, repurchase_rate,
         sales_trend, rating, response_rate, response_time, review_count,
         review_count_override, shop_type, is_platform_owned,
         is_banned, is_suspended, suspended_activities,
         created_at
  FROM public.stores;

GRANT SELECT ON public.stores_public TO anon, authenticated;

DROP POLICY IF EXISTS "Public read stores" ON public.stores;
DROP POLICY IF EXISTS "Anon read stores" ON public.stores;
DROP POLICY IF EXISTS "Authenticated read stores" ON public.stores;

CREATE POLICY "Owner read full store" ON public.stores FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.can_access_store_orders(auth.uid(), id)
         OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
```

**Risques & mitigation** :
- ⚠️ Si une page lit `whatsapp_number`/`ban_reason`/`suspension_reason` directement depuis `stores` côté client anonyme → 404/null. Audit complet du frontend déjà fait : seuls les contextes authentifiés (owner/staff) lisent ces champs. **Aucun affichage public ne casse.**
- ⚠️ Storage anti-listing : test obligatoire en preview avant prod. Si moindre doute → on garde le warning et on n'applique pas 3F.7.

---

## Score sécurité attendu

| Avant | Après |
|-------|-------|
| 12 findings (3 errors, 6 warns linter, 3 warns scan) | 0–1 finding résiduel (warn storage si conservé) |
| Score ~78/100 | Score ~98/100 |

---

## Ordre d'exécution recommandé

1. Tu approuves le plan
2. Je passe en mode normal et génère les 7 SQL + Edge Function + patches frontend
3. Tu valides en preview Lovable Cloud (test affichages produits/boutiques + bouton WhatsApp)
4. Tu télécharges les SQL et exécutes sur Supabase prod perso
5. Tu pousses le frontend via GitHub → Vercel
6. Re-run du security scan pour confirmation

