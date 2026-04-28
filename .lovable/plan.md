# Diagnostic régression checkout transitaires (prod `vpt...yxf`)

## Contexte

- 7 transitaires actifs visibles sur `/admin/forwarders` en prod (BRECHE FREIGHT, CONGO QUEEN, HAM Groupe, JH SOLUTION, PIVOT YARD, SAIDI EXPRESS, VERY SPEED).
- Hier ils s'affichaient au checkout. Aujourd'hui : 0 transitaire éligible.
- La migration RPC `get_eligible_forwarders` (correction colonne `tier`) a bien tourné en prod (`Success. No rows returned`).
- Mes outils Lovable interrogent `uog...zpu` (preview), **PAS** la prod `vpt...yxf` → diagnostic direct impossible depuis ici.

## Hypothèses (ordre de probabilité)

1. **Profils tarifaires inactifs ou mal géo-référencés** — un changement récent (ex. modification d'un profil, désactivation accidentelle, mauvais `country_code`) a fait que `forwarder_pricing_profiles.is_active=true AND mode='air' AND country_code='CD'` ne match plus aucun transitaire.
2. **Migration RPC a effacé un comportement** — la nouvelle version filtre `INNER JOIN fpp` strict alors que la précédente faisait peut-être `LEFT JOIN` + fallback.
3. **Données présentes mais filtre `mode` cassé** — les profils sont peut-être enregistrés avec `mode='aerien'` ou `'AIR'` au lieu de `'air'`.
4. **`is_platform_owned` mal positionné** — si tous les transitaires sont marqués `is_platform_owned=true`, ils tombent dans la branche fallback Very Speed.

## Diagnostic prod (à exécuter sur `vpt...yxf` via SQL Editor Supabase.com)

### Bloc A — État brut des transitaires + comptage profils
```sql
SELECT f.name, f.slug, f.is_active, f.is_platform_owned,
  COUNT(fpp.id) FILTER (WHERE fpp.is_active = true) AS active_profiles,
  COUNT(fpp.id) FILTER (WHERE fpp.is_active = true AND fpp.mode = 'air') AS air_profiles,
  COUNT(fpp.id) FILTER (WHERE fpp.is_active = true AND fpp.mode = 'air'
    AND (fpp.country_code IS NULL OR upper(fpp.country_code) = 'CD')) AS air_cd_profiles
FROM forwarders f
LEFT JOIN forwarder_pricing_profiles fpp ON fpp.forwarder_id = f.id
GROUP BY f.id, f.name, f.slug, f.is_active, f.is_platform_owned
ORDER BY f.name;
```

### Bloc B — Inspection des profils existants (modes & country_code réels)
```sql
SELECT f.name, fpp.mode, fpp.country_code, fpp.city_id, fpp.is_active,
  fpp.tier, fpp.price_multiplier, fpp.created_at, fpp.updated_at
FROM forwarder_pricing_profiles fpp
JOIN forwarders f ON f.id = fpp.forwarder_id
ORDER BY f.name, fpp.updated_at DESC;
```

### Bloc C — Test direct de la RPC
```sql
SELECT * FROM get_eligible_forwarders('CD', NULL, 'air');
```

### Bloc D — Définition actuelle de la RPC en prod
```sql
SELECT pg_get_functiondef('public.get_eligible_forwarders(text, uuid, text)'::regprocedure);
```

## Décision selon résultats

| Cas | Diagnostic | Correction |
|---|---|---|
| Bloc A montre `air_cd_profiles = 0` partout | Aucun profil tarifaire CD/air n'existe | Créer profils via `/admin/forwarders` (bouton `$`) — pas de code |
| Bloc B révèle `mode = 'aerien'` ou autre variante | Incohérence enum/string | Migration UPDATE pour normaliser `mode` |
| Bloc B montre `is_active = false` partout | Désactivation massive accidentelle | Migration UPDATE pour réactiver, puis investiguer cause |
| Bloc C retourne 7 lignes | Bug front (cache, mauvais paramètres passés à la RPC) | Inspecter `fetchEligibleForwarders` côté checkout, vérifier `country` / `mode` envoyés |
| Bloc D montre une définition incohérente | Migration mal appliquée | Re-jouer migration `20260428084202` |

## Livrable

Après analyse des 4 blocs, je proposerai **un seul correctif ciblé** :
- soit migration SQL prod (création/normalisation de profils),
- soit correction front (`forwarders.ts` / `ForwarderSelector.tsx`),
- soit aucune action code (juste créer profils via UI admin).

## Action immédiate demandée

Exécute les **4 blocs SQL ci-dessus en prod** (`vpt...yxf` via SQL Editor Supabase.com) et colle les résultats. Je n'ai aucun accès direct à cette base — c'est le seul chemin pour trancher entre les hypothèses sans risquer une migration aveugle qui casserait davantage.
