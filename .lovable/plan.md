

## Plan : Rendre la barre de navigation catégories entièrement dynamique via le CMS admin

### Constat actuel

La barre de navigation horizontale (Nouveautés, Soldes, Électronique, etc.) est **codée en dur** dans `Header.tsx` via le tableau `NAV_LINK_KEYS` (lignes 21-36). La table `cms_menu_items` existe déjà en base avec un système CRUD dans `MenusTab.tsx`, mais elle n'est **pas utilisée** par le Header — celui-ci ignore complètement les données CMS.

Les données actuelles dans `cms_menu_items` contiennent déjà des entrées `menu_group: "main"` (Accueil, Mode, Électronique, Beauté, Maison, Soldes) mais elles ne sont pas consommées.

### Architecture proposée

**Principe** : Remplacer le tableau statique `NAV_LINK_KEYS` par une requête dynamique sur `cms_menu_items` filtré par `menu_group = "category_nav"`, sans changer l'apparence visuelle.

#### 1. Migration DB — Ajouter des colonnes à `cms_menu_items`

Ajouter à la table existante :
- `parent_id UUID` (nullable, FK vers `cms_menu_items.id`) → pour les sous-menus
- `highlight BOOLEAN DEFAULT false` → pour styliser certains liens (ex: Soldes en rouge)
- `has_mega BOOLEAN DEFAULT false` → pour le déclencheur mega-menu
- `icon TEXT` (nullable) → emoji ou icône optionnelle
- `open_in_new_tab BOOLEAN DEFAULT false`

Puis insérer les items de la barre catégories actuelle en `menu_group = "category_nav"` pour que rien ne casse au déploiement.

#### 2. Header.tsx — Consommer les données CMS

- Ajouter un `useQuery` qui charge `cms_menu_items` où `menu_group = "category_nav"` et `is_visible = true`, trié par `sort_order`.
- Construire l'arbre parent/enfant pour supporter les sous-menus.
- Remplacer le rendu de `NAV_LINK_KEYS` par le rendu des items CMS.
- Conserver exactement le même style visuel (classes Tailwind, highlight pour Soldes, mega-menu pour Catégories).
- Fallback sur `NAV_LINK_KEYS` si la requête échoue (résilience).

#### 3. MenusTab.tsx — Enrichir l'interface admin

Transformer le formulaire admin existant pour supporter :
- **Sélecteur de groupe** avec options claires : `category_nav` (barre catégories), `main` (header principal), `footer`.
- **Champ parent_id** : select pour choisir un parent (sous-menu).
- **Toggle highlight** (mise en avant visuelle).
- **Toggle mega-menu** (déclenche le mega-menu au survol).
- **Drag-and-drop** pour réordonner (déjà visuellement suggéré par l'icône `GripVertical`).
- **Prévisualisation** de la barre en temps réel en haut du formulaire.
- Filtrage par groupe pour ne pas mélanger footer et category_nav.

#### 4. Pas de changement visuel côté utilisateur

L'affichage reste identique. Seule la source de données change : de hardcodé → dynamique CMS.

### Résumé des fichiers impactés

| Fichier | Modification |
|---|---|
| Migration SQL | Ajouter `parent_id`, `highlight`, `has_mega`, `icon`, `open_in_new_tab` + seed des items actuels |
| `Header.tsx` | Remplacer `NAV_LINK_KEYS` par `useQuery` sur `cms_menu_items` |
| `MenusTab.tsx` | Enrichir le formulaire avec les nouveaux champs, filtrage par groupe, preview |

### Ce que l'admin pourra faire après

- Ajouter/supprimer des catégories dans la barre de navigation
- Changer l'URL de destination de chaque élément
- Réordonner les éléments
- Activer/désactiver la visibilité
- Marquer un élément comme "highlight" (style Soldes)
- Ajouter des sous-menus (niveau 1)
- Tout cela sans toucher au code

