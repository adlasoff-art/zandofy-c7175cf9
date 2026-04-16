
# Fix analytics géographiques — rendre pays/ville réellement opérationnels

## Ce que j’ai confirmé
- Dans la base actuellement connectée, les champs `country`/`city` existent et la collecte a bien commencé à fonctionner au moins pour 1 session récente : 4 événements géolocalisés, et la fonction `get_analytics_top_countries(...)` renvoie déjà `Democratic Republic of the Congo`.
- Mais sur l’ensemble actuel, il n’y a que 4 lignes géolocalisées pour 2 389 événements et 51 sessions. Donc le problème n’est pas seulement visuel.
- Surtout, les fonctions SQL `get_analytics_top_countries` / `get_analytics_top_cities` ont été créées dans `supabase/migrations/...`, alors que votre workflow GitHub/Coolify utilise `frontend/supabase/migrations/` comme source de vérité. Le live que vous regardez peut donc très bien ne jamais avoir reçu cette migration.
- Le dashboard masque aussi les erreurs RPC en retournant un tableau vide quand la requête échoue. Résultat : si la fonction manque en production, vous voyez juste “Aucune donnée”.
- La carte “En ligne” ne compte pas la même chose : elle lit `profiles.is_online`, pas `analytics_events`. Donc 5 personnes en ligne n’impliquent pas automatiquement 5 visiteurs visibles par pays/ville.

## Plan de correction
1. **Remettre la migration au bon endroit**
   - Recréer proprement la migration des fonctions `get_analytics_top_countries` et `get_analytics_top_cities` dans `frontend/supabase/migrations/`.
   - Inclure les `GRANT EXECUTE` nécessaires pour coller au reste du dashboard.
   - Ne plus dépendre du dossier racine `supabase/migrations/` pour cette feature.

2. **Fiabiliser la collecte côté client**
   - Reprendre `frontend/src/hooks/use-analytics.ts`.
   - Remplacer `AbortSignal.timeout(3000)` par un pattern plus robuste type `AbortController`, déjà utilisé ailleurs dans le projet, pour éviter les échecs silencieux sur certains navigateurs.
   - Harmoniser la logique avec le hook géo existant pour réduire les divergences.

3. **Arrêter les faux “Aucune donnée”**
   - Dans `frontend/src/pages/admin/AdminAnalyticsPage.tsx`, ne plus convertir silencieusement une erreur RPC en `[]`.
   - Afficher un état d’erreur admin explicite si la fonction SQL n’existe pas, si les droits manquent, ou si l’environnement pointe vers une autre base.

4. **Vérifier l’environnement réellement consulté**
   - Contrôler si la page analytics que vous regardez pointe bien vers la même base que celle modifiée ici.
   - C’est important car la base que j’ai pu lire contient déjà 1 session géolocalisée, alors que vous voyez encore zéro : cela indique très probablement un décalage d’environnement ou de pipeline de migration.

5. **QA ciblée après correctif**
   - Ouvrir une nouvelle session propre (nouvel onglet / navigation privée).
   - Générer quelques visites réelles : comptes connectés + visiteur anonyme.
   - Vérifier que `session_start` et `page_view` enregistrent bien `country` et `city`.
   - Vérifier ensuite les widgets “1h”, “24h”, “48h” dans l’admin.

## Fichiers concernés
- `frontend/src/hooks/use-analytics.ts`
- `frontend/src/pages/admin/AdminAnalyticsPage.tsx`
- `frontend/supabase/migrations/<nouvelle_migration>.sql`

## Résultat attendu
- Les widgets pays/ville ne resteront plus vides à cause d’une erreur silencieuse.
- La collecte géographique sera plus fiable selon le navigateur.
- Le live utilisera enfin la bonne migration.
- Les nouvelles sessions commenceront à remonter correctement dans les cartes pays et ville.

## Détail technique
```text
Utilisateur → use-analytics.ts → analytics_events(country, city)
                     ↓
     RPC get_analytics_top_countries / cities
                     ↓
        AdminAnalyticsPage widgets pays / ville
```

Le point le plus probable à corriger en priorité est : **migration placée dans le mauvais dossier pour votre workflow**, puis **erreur RPC masquée par l’UI**.
