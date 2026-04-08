
Plan de correction rapide

1. Ce que j’ai vérifié
- Le workflow actif est `.github/workflows/deploy-edge-functions.yml`.
- Il déploie depuis `frontend/` et utilise `frontend/supabase/config.toml`.
- Le repo contient aussi un deuxième dossier `supabase/` à la racine, différent de `frontend/supabase/`.

2. Diagnostic le plus probable
- L’erreur actuelle arrive avant le vrai déploiement, au moment de `supabase link`, parce que `--project-ref` reçoit une valeur vide.
- Le problème n’est probablement pas la casse des noms de secrets : GitHub normalise les noms en majuscules et les références sont tolérantes à la casse.
- Le point fragile est surtout l’expression inline actuelle dans le YAML pour choisir les secrets selon la branche.
- Le mot de passe DB n’est pas la cause de cette erreur précise : si `project-ref` est vide, l’échec se produit avant même que le mot de passe serve réellement.

3. Correctif que je propose
- Modifier uniquement `.github/workflows/deploy-edge-functions.yml`.
- Remplacer le step unique actuel par 2 steps explicites, un pour `develop`, un pour `main`, avec les secrets appelés directement sans logique compacte `&& ||`.

```text
develop -> SUPABASE_PROJECT_ID + SUPABASE_DB_PASSWORD
main    -> PRODUCTION_PROJECT_ID + PRODUCTION_DB_PASSWORD
```

- Ajouter un pré-contrôle non sensible dans le workflow :
  - vérifier que `PROJECT_REF` existe
  - vérifier que `DB_PASS` existe
  - vérifier que `SUPABASE_ACCESS_TOKEN` existe
  - afficher seulement la branche cible et l’environnement choisi, jamais les secrets

4. Pourquoi cette approche est la bonne
- Elle supprime l’ambiguïté de l’expression actuelle.
- Elle rend le log GitHub beaucoup plus clair : on saura immédiatement si le run est “develop” ou “main”.
- Elle respecte votre architecture actuelle sans toucher aux variables, à Docker, ni au reste du déploiement.

5. Point important que je corrigerai aussi mentalement dans le repo
- Le workflow déploie `frontend/supabase/**`, pas `supabase/**` à la racine.
- Donc pour les prochains tests automatiques, les changements de fonctions doivent être faits dans `frontend/supabase/functions/`, sinon cela crée de la confusion.

6. Validation prévue après patch
- Lancer un `workflow_dispatch` sur `develop`
- Vérifier que le job passe le pré-contrôle et ne tombe plus sur `flag needs an argument: --project-ref`
- Faire ensuite un mini changement sans impact dans `frontend/supabase/functions/**` pour confirmer le déclenchement automatique
- Si un échec subsiste après ça, on saura que ce ne sera plus un problème de `project-ref`, mais possiblement de mot de passe DB, de lien projet, ou d’une fonction spécifique

Détails techniques
- Fichier à modifier : `.github/workflows/deploy-edge-functions.yml`
- Aucun changement DB
- Aucun changement frontend
- Aucun renommage de secret requis
- Nettoyage optionnel ensuite : harmoniser à terme `supabase/` racine vs `frontend/supabase/` pour éviter les faux diagnostics
