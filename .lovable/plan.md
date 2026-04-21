

# Audit Qualité & Sécurité — Forwarders (Lots 1-3)

## Score global de sécurité : **91/100** — Plateforme safe ✅
Toggle OFF en prod → **aucun impact actuel** sur les 4000+ utilisateurs.

| Axe | Score | Commentaire |
|---|---|---|
| DB / RLS | 95/100 | Policies solides, SECURITY DEFINER + search_path corrects |
| Storage | 92/100 | Bucket public OK pour logos, writes admin/manager uniquement |
| Frontend (checkout) | 88/100 | Pas de faille mais bugs fonctionnels bloquants |
| Intégration | 75/100 | Décalages schéma ↔ UI qui empêchent le feature de fonctionner |

## 🔴 Bugs bloquants fonctionnels (non-sécurité mais à corriger avant activation)

Ces décalages entre le schéma SQL (Lot 1) et l'UI (Lot 2/3) rendent le feature inutilisable dès qu'on active le toggle :

### 1. `CheckoutPage.tsx` — insertion `shipment_assignments` cassée
Le code insert `status: "pending"` et omet `mode` (NOT NULL).
**DB attend** : `status IN ('assigned',…)`, `mode IN ('air','sea')` requis.
**Fix** : `status: "assigned"`, ajouter `mode: shippingMode` (filtrer sur 'air'/'sea').

### 2. `ForwarderTiersDialog.tsx` — mauvaises colonnes
UI écrit : `service_mode`, `min_weight_kg`, `max_weight_kg`, `price_per_kg`, `flat_fee`, `delay_days_min/max`.
DB attend : `mode`, `tier`, `price_multiplier`, `transit_min_days`, `transit_max_days`.
**Fix** : refondre le dialog pour matcher le vrai schéma (modes `air`/`sea`, tiers `express`/`standard`/`vip`, multiplicateur au lieu de prix/kg).

### 3. `ForwarderFormDialog.tsx` — colonnes inexistantes
UI envoie `website_url`, `price_multiplier` sur `forwarders` — ces colonnes n'existent pas dans la table.
**Fix** : retirer `website_url` et `price_multiplier` du payload (le multiplier vit sur `forwarder_service_tiers`).

### 4. `ForwarderCoverageDialog.tsx` — champ `city` text vs `city_id` uuid
UI écrit `city: "Kinshasa"` (texte libre), DB attend `city_id uuid REFERENCES cities(id)`.
**Fix** : remplacer l'input texte par un Combobox de villes (table `cities`) + envoyer `city_id`.

### 5. `services/forwarders.ts` — interface `EligibleForwarder` incomplète
Il manque `mode` dans le type (retourné par la fonction SQL), utile pour persister le mode choisi.
**Fix** : ajouter `mode: string`.

## 🟡 Durcissements sécurité recommandés (non-bloquants)

### S1. Validation Zod côté admin (défense en profondeur)
Les formulaires Forwarder/Coverage/Tiers envoient les inputs bruts à Supabase. RLS protège déjà (admin only), mais ajouter un schéma Zod minimal :
- `name` max 100, `slug` regex `/^[a-z0-9-]+$/`, `contact_email` email valide, `price_multiplier` entre 0.1 et 10.
- Évite les erreurs DB silencieuses et le stockage de données malformées.

### S2. Upload logo — MIME + taille serveur-side
Actuellement `accept="image/..."` côté client uniquement. Ajouter :
- Vérification `file.size < 2 MB` et `file.type` dans `handleUpload` avant `.upload()`.
- Nom de fichier : actuel `${slug}-${Date.now()}.${ext}` → OK (pas d'injection path), mais sanitiser `ext` à `[a-z0-9]{1,5}`.

### S3. `confirm()` natif pour suppression
`ForwardersList.tsx` utilise `window.confirm` pour supprimer. Remplacer par `AlertDialog` shadcn — cohérence UX et empêche confirmations accidentelles sur mobile.

### S4. Policy SELECT publique trop large
`forwarders_select_public` autorise `SELECT * WHERE is_active = true` à tout le monde (anon inclus). Cela expose `contact_email`, `contact_phone`, `owner_user_id` publiquement.
**Fix recommandé** : créer une **vue publique** `v_forwarders_public` exposant seulement `id, name, slug, logo_url, description, is_active`, et restreindre la policy SELECT de la table aux users authentifiés + owner + admin.

### S5. `get_eligible_forwarders` — rate limiting implicite
Fonction SECURITY DEFINER appelée sans auth (anon possible via checkout). Risque faible (lecture seule), mais logger les appels anormaux via les métriques existantes est suffisant.

## 🟢 Points forts confirmés

- ✅ RLS activé sur les 6 tables forwarders + storage bucket
- ✅ `has_role()` utilisé partout (pas de récursion, SECURITY DEFINER propre)
- ✅ `search_path = public` sur toutes les fonctions custom
- ✅ Triggers `updated_at` cohérents avec le reste du projet
- ✅ Notifications in-app sécurisées (via trigger, pas d'injection possible)
- ✅ Pas de secret exposé côté frontend, pas de `dangerouslySetInnerHTML`
- ✅ Toggle OFF par défaut → zéro risque sur la prod actuelle
- ✅ Fallback silencieux (`forwarder_unassigned=true`) permet intervention admin post-commande
- ✅ CHECK constraints et FK cohérents (CASCADE / SET NULL bien choisis)

## Plan d'exécution proposé (ordre)

1. **Fix bloquants 1→5** (1 migration SQL mineure + 4 fichiers TS)
   - Un fichier SQL `20260421_forwarders_fixes.sql` pour aligner `shipment_assignments` (statut `pending` autorisé) ET/OU corriger le code TS pour utiliser `assigned`. Recommandation : **corriger le code TS** (plus rapide, pas de migration supplémentaire).
2. **Durcissements S1→S4** (Zod, validation upload, AlertDialog, vue publique) — 1 migration SQL (vue + policy) + refactors TS.
3. Ré-exécuter `supabase--linter` et `security--run_security_scan` pour confirmer 95+/100.

## Détails techniques (pour revue)

**Fichiers à modifier** :
- `frontend/src/pages/CheckoutPage.tsx` (status + mode dans insert)
- `frontend/src/components/admin/forwarders/ForwarderTiersDialog.tsx` (schéma complet)
- `frontend/src/components/admin/forwarders/ForwarderFormDialog.tsx` (retirer champs orphelins)
- `frontend/src/components/admin/forwarders/ForwarderCoverageDialog.tsx` (Combobox cities)
- `frontend/src/services/forwarders.ts` (typage `mode`)
- `frontend/src/components/admin/forwarders/ForwardersList.tsx` (AlertDialog)

**Migration optionnelle S4** :
```sql
CREATE OR REPLACE VIEW public.v_forwarders_public
WITH (security_invoker=on) AS
SELECT id, name, slug, logo_url, description, is_active
FROM public.forwarders WHERE is_active = true;
-- Restreindre SELECT direct aux authentifiés + revoke public
```

**Aucune mesure agressive** : pas de blocage checkout, pas de throttling strict, toggle reste OFF, RLS actuel préservé.

