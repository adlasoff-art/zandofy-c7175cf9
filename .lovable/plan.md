
Objectif: remettre la plateforme en état sans annuler le durcissement sécurité, en corrigeant les points qui cassent l’affichage, l’authentification et l’accès admin.

Diagnostic le plus probable
1. CSP trop stricte et codée en dur dans `frontend/index.html`
   - `connect-src`, `img-src`, `preconnect` et `dns-prefetch` autorisent un seul hôte backend stocké en dur.
   - Sur staging/prod/GitHub/Vercel, si l’URL backend réelle est différente, cela bloque:
     - les lectures backend,
     - les images stockées,
     - certaines opérations d’authentification, dont la déconnexion.
   - C’est la cause la plus forte pour: structure visible mais contenu/images absents.

2. Risque d’écran blanc au bootstrap
   - `frontend/src/hooks/useGeoBlocking.ts` ne termine pas proprement si la requête initiale échoue vraiment.
   - `App.tsx` rend `null` tant que `GeoBlockGuard` est “loading”.
   - Chaîne probable:
     ```text
     requête config bloquée/échouée
       -> settingsLoaded ne passe jamais à true
       -> GeoBlockGuard reste en attente
       -> écran blanc
     ```

3. Le rôle admin n’a probablement pas été perdu en base
   - La capture réseau actuelle montre encore `user_roles = admin` pour le compte observé.
   - Donc le problème “admin disparu” semble frontend/session, pas une suppression réelle du rôle.

4. `useRoles` fige aussi les échecs
   - Dans `frontend/src/hooks/use-roles.ts`, l’utilisateur est marqué comme “déjà chargé” même si la lecture des rôles échoue.
   - Résultat: un échec transitoire peut figer `roles=[]`, masquer “Administrateur” et bloquer les routes protégées jusqu’au reload.

5. La déconnexion est fragile
   - `AuthContext.signOut()` dépend d’un appel réseau.
   - Dans le Header, le clic n’attend pas la promesse et ne traite pas l’échec.
   - Si l’appel auth est bloqué par CSP/réseau, l’utilisateur reste coincé.

6. La lecture publique de `platform_settings` est trop limitée pour le frontend actuel
   - La politique publique autorise un sous-ensemble de clés.
   - Or le code lit aussi publiquement: `branding`, `header_theme`, `theme_colors`, `topbar_config`, `geo_blocked_countries`, `active_countries`, `cookie_settings`, `seo_config`.
   - Effets attendus: logo, thème, topbar, cookies, géoblocage, branding partiel qui ne chargent plus correctement.

7. Le modèle “vue publique” n’est pas encore aligné avec le storefront
   - `stores_public` existe, mais le frontend continue de faire plusieurs lectures publiques sur `stores`/jointures directes.
   - Donc le durcissement backend et les requêtes frontend ne sont pas encore parfaitement raccordés.

8. Le service worker peut aggraver les symptômes
   - `frontend/public/sw.js` contient aussi une URL backend figée.
   - Après plusieurs déploiements, le cache peut conserver un état incohérent et amplifier l’impression de panne.

Plan de correction recommandé
1. Restaurer d’abord la disponibilité
   - Corriger la CSP pour qu’elle soit dépendante de l’environnement au lieu d’une URL backend codée en dur.
   - Autoriser l’hôte backend courant dans `connect-src`, `img-src`, `preconnect` et `dns-prefetch`.
   - Garder la protection XSS, mais arrêter de casser staging/prod.

2. Éliminer définitivement l’écran blanc de bootstrap
   - Corriger `useGeoBlocking` avec un vrai `catch/finally` et un fallback fail-open.
   - Vérifier que les hooks racine de config ne peuvent jamais bloquer tout l’arbre React.

3. Réparer l’affichage admin sans relâcher la sécurité
   - Corriger `useRoles` pour:
     - ne mémoriser un utilisateur “chargé” qu’après succès réel,
     - réinitialiser correctement sur erreur,
     - éventuellement retenter la lecture après restauration de session.
   - Faire attendre proprement auth + rôles avant tout rendu admin.

4. Rendre la déconnexion fiable
   - Passer à une déconnexion locale robuste côté client, avec nettoyage réseau en best effort si nécessaire.
   - Attendre la promesse dans le Header/AdminLayout et remettre l’état auth à zéro proprement.

5. Faire une migration corrective minimale
   - Une seule migration ciblée, pas une réexécution confuse des anciens lots.
   - Cette migration devra:
     - élargir proprement la lecture publique de `platform_settings` aux clés publiques réellement utilisées,
     - compléter si besoin les politiques `SELECT` publiques des contenus CMS strictement publics,
     - ne pas réouvrir les buckets privés ni les tables sensibles.

6. Réaligner le storefront avec le modèle public sécurisé
   - Là où c’est nécessaire, basculer les lectures publiques vers les vues publiques (`stores_public`, et `products_public` si appropriée/disponible) au lieu des tables brutes.
   - Conserver les champs sensibles masqués.

7. Nettoyer la couche cache/PWA
   - Retirer les URL backend figées du service worker.
   - Forcer une invalidation propre des caches après correctif pour éviter les faux positifs post-déploiement.

8. Vérification finale multi-environnements
   - Lovable preview: plus d’écran blanc.
   - Staging Vercel: données, bannières, images produits, logos visibles.
   - Production: mêmes vérifications.
   - Compte admin: lien “Administrateur” visible, routes admin accessibles.
   - Déconnexion/reconnexion: fonctionnement normal.
   - Sécurité conservée: pas de réouverture des buckets privés, pas d’exposition des données sensibles.

Fichiers prioritaires
```text
frontend/index.html
frontend/src/hooks/useGeoBlocking.ts
frontend/src/hooks/use-roles.ts
frontend/src/contexts/AuthContext.tsx
frontend/src/components/Header.tsx
frontend/src/components/admin/AdminLayout.tsx
frontend/public/sw.js
frontend/src/hooks/use-push-notifications.ts
```

Lots/morceaux les plus suspects
```text
- durcissement CSP récent
- restriction publique de platform_settings (migration 20260317201809_...)
- ajout de stores_public sans réalignement complet des requêtes frontend (migration 20260409082324_...)
```

Conclusion
- Je ne vois pas d’indice fort que le rôle admin ait été supprimé en base.
- Le noyau du problème semble être un cumul de:
  - CSP trop stricte et figée,
  - bootstrap frontend fail-close,
  - hook de rôles qui mémorise un échec,
  - politique publique de configuration trop étroite pour le frontend actuel.
- Je recommande donc une correction chirurgicale orientée disponibilité, puis un réalignement propre entre sécurité et storefront, plutôt qu’un rollback global des protections.
