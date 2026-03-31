

# Fix: Régénérer le script de schéma production

## Problème identifié

Le script `zandofy_production_schema.sql` a été généré en extrayant les définitions de politiques RLS depuis les vues système de PostgreSQL (`pg_policies`). Ces vues retournent les rôles au format tableau `{public}` ou `{authenticated}`, ce qui n'est pas du SQL valide.

**Erreur** : `TO {public}` → doit être `TO public`  
Cela affecte potentiellement **toutes les 309 politiques RLS** du fichier.

## Correction

Régénérer le fichier `zandofy_production_schema.sql` en corrigeant la requête d'extraction des politiques pour :

1. Remplacer `roles::text` par un `array_to_string` ou `unnest` qui produit `TO public` / `TO authenticated` sans accolades
2. Vérifier que toutes les clauses `USING(...)` et `WITH CHECK(...)` sont correctement échappées
3. Produire un nouveau fichier `zandofy_production_schema_v2.sql`

## Scope

- Un seul fichier artifact à régénérer : `/mnt/documents/zandofy_production_schema_v2.sql`
- Aucune modification au code du projet
- Même structure logique (Extensions → Enums → Tables → FK → Functions → Triggers → RLS → Realtime)

