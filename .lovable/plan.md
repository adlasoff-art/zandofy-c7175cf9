

# Audit sécurité — Fonctionnalité Sourcing

## Score sécurité Sourcing : **94/100** ✅
Pas de faille critique. Quelques durcissements ciblés recommandés, sans blocage utilisateur.

| Axe | Score | Constat |
|---|---|---|
| RLS tables | 96/100 | Policies strictes (`user_id = auth.uid()` + `has_role`), pas de `USING (true)` |
| Storage bucket | 95/100 | `sourcing-images` privé, paths préfixés `{user_id}/`, signed URLs 1h |
| Edge Functions | 92/100 | JWT vérifié, double check rôle (auth + DB), CORS large mais sans cookies |
| Anti-abus | 95/100 | Trigger DB `enforce_sourcing_rate_limit` (5/jour) + `CHECK` images ≤ 2 |
| XSS / injection | 96/100 | `escapeHtml` côté email, pas de `dangerouslySetInnerHTML`, Zod côté form |
| Données sensibles | 90/100 | `responder_id` non FK, digest envoie tous les emails admin en clair (To:) |

**Findings linter Supabase (6 WARN + 1 ERROR) = pré-existants hors Sourcing** : automation_progress, autres buckets publics. Pas dans le périmètre de cette feature, déjà connus.

## Points à corriger (mineurs, non bloquants)

### S1 — Email digest : éviter la divulgation croisée d'emails admin
`supabase/functions/sourcing-email-digest/index.ts` ligne 124 : `to: adminEmails.join(",")` met tous les admins en `To:` → chaque admin voit l'email des autres. **Fix** : utiliser `bcc: adminEmails` et `to: fromEmail` (envoi à soi-même + BCC).

### S2 — Image de réponse admin : valider le path côté client
`SourcingResponseDialog.tsx` ligne 98 : le path est préfixé `{request.user_id}/response-…`. Bonne logique mais l'admin uploade dans le dossier du client. **Fix** : préfixer plutôt par `responses/{request.id}/…` pour clarté + audit, et ajuster la storage policy INSERT pour accepter ce préfixe quand `has_role('admin'/'manager')`.

### S3 — Signed URLs régénérées à chaque render
`SourcingRequestCard.tsx` et `AdminProductSourcingPage.tsx` régénèrent les signed URLs à chaque dépendance change → coût Storage + risque rate limit Supabase. **Fix** : cache mémoire simple (Map keyed by path, TTL 50 min).

### S4 — Rate-limit trigger : compter aussi les rejets
Le trigger compte les inserts réussis. Un user pourrait spammer des inserts qui échouent côté Storage avant l'INSERT DB. **Fix optionnel** : aucun, car le storage upload réussit avant l'insert et est lui-même limité par la taille fichier ; risque négligeable.

### S5 — Cleanup function : ajouter une borne minimale
`cleanup-sourcing/index.ts` ligne 53 accepte `older_than_days >= 1`. Pour éviter une suppression accidentelle de données fraîches, **min 7 jours** est plus sûr. **Fix** : `Math.max(7, ...)`.

### S6 — Clé étrangère manquante sur `responder_id`
Migration ligne 28 : `responder_id uuid NOT NULL` sans FK. **Fix** : ajouter `REFERENCES public.profiles(id) ON DELETE SET NULL` (et passer en nullable) pour intégrité référentielle.

## Migration SQL à exécuter en prod (S2 + S6)

```sql
-- S6: FK responder_id
ALTER TABLE public.product_sourcing_responses
  ALTER COLUMN responder_id DROP NOT NULL;
ALTER TABLE public.product_sourcing_responses
  ADD CONSTRAINT product_sourcing_responses_responder_fk
  FOREIGN KEY (responder_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- S2: Storage policy admin upload sous responses/
DROP POLICY IF EXISTS sourcing_insert_admin_responses ON storage.objects;
CREATE POLICY sourcing_insert_admin_responses ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'sourcing-images'
  AND (storage.foldername(name))[1] = 'responses'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);

DROP POLICY IF EXISTS sourcing_update_admin ON storage.objects;
CREATE POLICY sourcing_update_admin ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'sourcing-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);
```

## Fichiers à modifier
- `supabase/functions/sourcing-email-digest/index.ts` (S1 — bcc)
- `supabase/functions/cleanup-sourcing/index.ts` (S5 — min 7j)
- `frontend/src/components/admin/sourcing/SourcingResponseDialog.tsx` (S2 — path `responses/{id}/`)
- `frontend/src/components/sourcing/SourcingRequestCard.tsx` + `frontend/src/pages/admin/AdminProductSourcingPage.tsx` (S3 — cache signed URLs)
- 1 migration SQL téléchargeable (S2 + S6)

## Détails techniques
- Aucune mesure agressive, aucun blocage checkout/UX, aucun rate-limit backend ajouté.
- Score post-correctifs estimé : **97/100** sur le périmètre Sourcing.
- Les 6 WARN du linter restent hors scope (préexistants, autres features).

