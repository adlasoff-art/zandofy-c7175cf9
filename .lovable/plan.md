## Diagnostic confirmé (prod)

Les 7 transitaires prod ont **tous** :
- `coverage_routes = []` → écartés par le filtre origine du checkout (`FreightSelector` → RPC `get_eligible_forwarders_v2` → fallback JS sur `coverage_routes`).
- `supported_modes = ["air"]` → écartés en plus pour toute commande `sea`, même quand un profil `sea` actif existe.

→ Aucun transitaire ne s'affiche au checkout, pour aucune origine, parce que ces deux colonnes n'ont jamais été peuplées. Aucun bug code, aucune régression de migration : c'est une **donnée manquante** introduite par le Lot 4C / Lot 11C qui a ajouté ces deux filtres sans backfill.

Référence : `mem://features/forwarder-origin-filtering`, `mem://features/forwarders-and-logistics-system`.

## Réponse à votre question initiale

> "Indique-moi la démarche pour utiliser les profils déjà créés, sans repartir à zéro."

**Aucune recréation de profil nécessaire.** Vos 10 `forwarder_pricing_profiles` sont parfaitement valides. Il faut juste **compléter 2 colonnes manquantes** sur la table `forwarders` :

1. `supported_modes` : ajouter `"sea"` aux 4 transitaires qui ont des profils `sea`.
2. `coverage_routes` : déclarer pour chaque transitaire la liste des routes `origine produit → RDC` qu'il accepte.

## Démarche recommandée — 2 voies au choix

### Voie A — UI admin (votre demande explicite, à privilégier)

Étape 1 : j'inspecte `frontend/src/components/admin/forwarders/` (`ForwardersList.tsx` et le dialog d'édition) pour vérifier si les champs **"Modes supportés"** et **"Routes desservies"** sont déjà éditables.

- Si **oui** → je vous fournis la procédure step-by-step pour les remplir vous-même via `/admin/forwarders` sur prod.
- Si **non** → je les ajoute dans le dialog d'édition (multi-select pour `supported_modes`, table éditable origine/destination pour `coverage_routes`), je commit, GitHub Actions déploie sur Vercel, vous remplissez ensuite à votre rythme.

### Voie B — UPDATE SQL ciblé immédiat (déblocage urgent prod, optionnel)

Si vous voulez débloquer le checkout **maintenant** pendant que l'UI est complétée, je vous prépare un seul `UPDATE` SQL par transitaire, à exécuter sur prod (Supabase.com perso `vpt...yxf`). Calqué sur les profils réels que vous avez fournis :

```sql
-- CONGO QUEEN SARL : profils air (Lubumbashi, Kolwezi) + sea (Lubumbashi)
UPDATE forwarders SET
  supported_modes = ARRAY['air','sea'],
  coverage_routes = '[
    {"origin_country":"CN","destination_country":"CD"},
    {"origin_country":"TR","destination_country":"CD"},
    {"origin_country":"AE","destination_country":"CD"}
  ]'::jsonb
WHERE id = '4bf28ac7-2e08-4bcc-b765-7f54d4c6c1da';

-- HAM Groupe : profil sea (Kinshasa)
UPDATE forwarders SET
  supported_modes = ARRAY['sea'],
  coverage_routes = '[
    {"origin_country":"CN","destination_country":"CD"},
    {"origin_country":"TR","destination_country":"CD"},
    {"origin_country":"AE","destination_country":"CD"}
  ]'::jsonb
WHERE id = '9f67345b-74f1-4372-9474-cecf4f6ae9b5';

-- JH SOLUTION : profils air + sea (Kinshasa)
UPDATE forwarders SET
  supported_modes = ARRAY['air','sea'],
  coverage_routes = '[
    {"origin_country":"CN","destination_country":"CD"},
    {"origin_country":"TR","destination_country":"CD"},
    {"origin_country":"AE","destination_country":"CD"}
  ]'::jsonb
WHERE id = '124b8c30-876d-431e-bbc6-8ea411210ed5';

-- PIVOT YARD LOGISTICS : profils sea (Goma, Bukavu)
UPDATE forwarders SET
  supported_modes = ARRAY['sea'],
  coverage_routes = '[
    {"origin_country":"CN","destination_country":"CD"},
    {"origin_country":"TR","destination_country":"CD"},
    {"origin_country":"AE","destination_country":"CD"}
  ]'::jsonb
WHERE id = '752c73c6-b76c-4192-b563-719358cdaa9b';

-- SAIDI EXPRESS CARGO : profil air (Kinshasa)
UPDATE forwarders SET
  supported_modes = ARRAY['air'],
  coverage_routes = '[
    {"origin_country":"CN","destination_country":"CD"},
    {"origin_country":"TR","destination_country":"CD"},
    {"origin_country":"AE","destination_country":"CD"}
  ]'::jsonb
WHERE id = '6bd72abb-d5b1-4c86-b0cf-c51224096c27';

-- VERY SPEED : profil air (Kinshasa)
UPDATE forwarders SET
  supported_modes = ARRAY['air'],
  coverage_routes = '[
    {"origin_country":"CN","destination_country":"CD"},
    {"origin_country":"TR","destination_country":"CD"},
    {"origin_country":"AE","destination_country":"CD"}
  ]'::jsonb
WHERE id = '20872af4-5a50-4512-aaf5-358cb4389901';

-- BRECHE FREIGHT : aucun profil dans le diag fourni — à confirmer avec vous
-- (pas d'update tant que vous ne m'indiquez pas modes/routes)
```

Les pays d'origine (`CN`, `TR`, `AE`) sont une **proposition par défaut** basée sur votre positionnement Sino-Africain. Je n'écrirai cet UPDATE qu'**après votre validation** de la liste des origines réelles par transitaire (chaque transitaire accepte-t-il vraiment ces 3 origines, ou seulement certaines ?).

## Action concrète que je propose en mode build

1. **Lecture du code admin forwarders** pour savoir si `supported_modes` et `coverage_routes` sont déjà éditables via `/admin/forwarders` (10 min).
2. **Réponse 1** : "champs déjà présents → voici comment les remplir" OU "champs absents → je les ajoute".
3. **Si champs absents** : ajout dans `ForwardersList.tsx` / dialog d'édition (multi-select modes + éditeur de routes), zéro impact sur la logique checkout.
4. **Vous demande explicitement** si vous voulez aussi la **Voie B** (UPDATE SQL immédiat) en parallèle, et avec **quelles origines exactes par transitaire** (CN seul ? CN+TR ? CN+TR+AE+autres ?).

## Détails techniques

- Aucun changement de schéma (les colonnes existent déjà).
- Aucune migration nécessaire pour la donnée — c'est de l'UPDATE en table `forwarders`.
- Pour la Voie B, en mode build je passerais par le **insert tool** (qui gère INSERT/UPDATE/DELETE en données) ciblé sur la base **prod** uniquement, pas Lovable Cloud.
- Aucun fichier de pricing engine, aucune RPC, aucun composant checkout n'est modifié. Logique stricte (pas d'éligibilité par défaut) **conservée**.

## Validation post-fix

Après remplissage (par UI ou SQL), au checkout :
- Produit origine `CN` + livraison Kinshasa + mode `air` → doit afficher JH SOLUTION, SAIDI EXPRESS CARGO, VERY SPEED.
- Produit origine `CN` + livraison Lubumbashi + mode `sea` → doit afficher CONGO QUEEN SARL.
- Produit origine `CN` + livraison Goma + mode `sea` → doit afficher PIVOT YARD LOGISTICS.

Si ces 3 cas affichent les bons transitaires, le checkout est débloqué et la logique stricte est respectée à la lettre.
