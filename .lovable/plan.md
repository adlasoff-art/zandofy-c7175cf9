
Objectif: rendre la page Analytics fiable, lisible et cohérente avant toute présentation à des partenaires, tout en corrigeant définitivement l’affichage des noms produits.

Constat confirmé après lecture du code
1. Le problème de nom produit n’est pas réellement corrigé dans l’état actuel du code: dans `AdminAnalyticsPage.tsx`, le widget “Produits les plus cliqués” affiche encore `id.slice(0, 8)` au lieu du nom.
2. La page Analytics calcule presque tout côté navigateur à partir d’une lecture brute de `analytics_events` triée par date. Cette approche est fragile pour de l’historique:
   - elle dépend d’un fetch limité (`limit(50000)` dans le code, avec en pratique un plafonnement backend possible),
   - elle ne travaille que sur la fenêtre la plus récente des événements récupérés,
   - donc les chiffres peuvent bouger à la baisse quand de nouveaux événements entrent et que d’anciens sortent de la fenêtre.
3. L’histogramme “Trafic journalier” groupe seulement les jours présents dans les événements chargés. Il ne génère pas une vraie série de jours pour 48h / 7j / 30j / 90j / 1 an / Tout. C’est pour cela que vous pouvez voir une seule “bougie”.
4. Le widget “Connectés” est trompeur: aujourd’hui il compte des `user_id` distincts vus dans les événements de la période, pas les personnes réellement en ligne maintenant. Il n’est donc pas comparable au module Utilisateurs.
5. “PWA installées” et “PWA vs Navigateur” ne mesurent pas la même chose:
   - `PWA installées` = appareils installés enregistrés dans `pwa_installs`,
   - `PWA vs Navigateur` = sessions analytics marquées `is_pwa` sur la période.
   Les deux peuvent être justes séparément, mais leur libellé actuel prête à confusion.
6. Il y a en plus un bloqueur de build indépendant de l’Analytics: les fonctions mail Deno utilisent `npm:nodemailer@6.9.16` sans configuration de dépendance compatible. Tant que ce build n’est pas assaini, certains changements peuvent ne pas se propager proprement.

Plan de correction
1. Sécuriser d’abord le pipeline de build
   - corriger la configuration des fonctions mail concernées (`notify-order-status` et `run-campaign`) pour que la build reparte proprement,
   - revalider le build frontend ensuite.
   But: éviter qu’un fix Analytics soit “écrit” mais non livré.

2. Remplacer les calculs bruts côté frontend par des agrégations backend dédiées
   - créer des fonctions SQL / vues de lecture pour l’Analytics admin,
   - calculer au backend les KPI, les tops et l’histogramme à partir de tout l’historique filtré, pas d’un simple lot d’événements récents,
   - conserver toutes les modifications via migrations versionnées, sans édition manuelle.

3. Corriger la logique des métriques pour qu’elles soient stables et cohérentes
   - `Visiteurs` = sessions uniques sur la période,
   - `Anonymes` = sessions uniques sans compte sur la période,
   - remplacer `Connectés` par une métrique cohérente:
     - recommandé: `Sessions authentifiées`, pour que `sessions authentifiées + anonymes = visiteurs`,
     - et/ou ajouter une vraie carte `En ligne maintenant` basée sur la présence réelle.
   - clarifier la PWA:
     - `PWA installées` = appareils installés cumulés,
     - renommer le bloc comparatif en `Sessions PWA vs Sessions Web`,
     - option recommandée: ajouter aussi `PWA actives sur la période` via `last_seen_at`.

4. Refondre l’histogramme journalier
   - générer une vraie série de dates avec un bucket par jour sur l’intervalle choisi,
   - remplir les jours sans trafic avec zéro,
   - garantir:
     - 24h = 1 bucket journalier,
     - 48h = 2,
     - 7j = 7,
     - 30j = 30,
     - 90j = 90,
     - 1 an = 365,
     - Tout = de la première date disponible à aujourd’hui,
   - corriger aussi le découpage temporel pour éviter un simple `created_at.slice(0,10)` trop naïf.

5. Corriger définitivement les noms produits
   - faire remonter les “top produits” avec jointure vers `products.name` directement dans l’agrégation backend,
   - garder un fallback sur l’ID tronqué seulement si le produit n’existe plus,
   - appliquer la même logique cohérente que pour les boutiques.

6. Mettre à jour `AdminAnalyticsPage.tsx`
   - brancher la page sur les nouvelles sources agrégées,
   - conserver les filtres actuels (24h, 48h, 7j, 30j, 3 mois, 1 an, Tout),
   - améliorer les libellés pour qu’ils reflètent exactement ce qui est mesuré.

Détails techniques
- Migration probable:
  - fonctions SQL de lecture Analytics admin,
  - éventuellement index complémentaires sur `analytics_events(created_at, event_type, session_id, user_id, product_id, store_id)` si nécessaire.
- Pas de changement d’infra, de domaines, de Docker, de variables d’environnement ni de workflow Git.
- Les tables existantes restent la source de vérité; on fiabilise surtout la façon de les agréger et de les afficher.

Résultat attendu après implémentation
- le produit cliqué s’affiche par son vrai nom,
- les compteurs ne “dégringolent” plus artificiellement sur 30 jours à cause d’une fenêtre partielle,
- l’histogramme montre bien un point/barre par jour sur la période choisie,
- la différence entre visiteurs, anonymes, sessions authentifiées, présence en ligne et PWA devient explicite et défendable.
