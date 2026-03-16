

## Plan : Drag & Drop pour réorganiser les éléments du menu (CMS)

### Contexte
L'onglet "Menus" du CMS admin affiche déjà une icône `GripVertical` sur chaque élément, mais aucun drag & drop n'est implémenté. Le `sort_order` existe en base. Il faut rendre le tri fonctionnel.

### Approche technique

**1. Installer `@dnd-kit`**
- Ajouter `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` au `package.json` frontend. C'est la librairie DnD la plus légère et moderne pour React.

**2. Modifier `MenusTab.tsx`**
- Wrapper la liste des parents avec `DndContext` + `SortableContext` (stratégie `verticalListSortingStrategy`).
- Chaque `MenuItemRow` parent devient un `useSortable` item, l'icône `GripVertical` sert de handle via `listeners` + `attributes`.
- Sur `onDragEnd` : recalculer le `sort_order` de chaque parent dans le nouvel ordre, puis batch-update en base via des appels `supabase.from("cms_menu_items").update({ sort_order }).eq("id", id)`.
- L'aperçu de la barre de navigation se met à jour instantanément (état local modifié en premier, puis persisté).

**3. Sous-éléments (children)**
- Même principe : dans chaque groupe de children, un `SortableContext` imbriqué permet de réordonner les sous-menus d'un parent.

**4. Persistance**
- Après un drag, on envoie un batch d'updates `sort_order` (un par élément déplacé). Pas de migration nécessaire, la colonne `sort_order` existe déjà.

### Fichiers modifiés
| Fichier | Action |
|---|---|
| `frontend/package.json` | Ajouter `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| `frontend/src/components/admin/cms/MenusTab.tsx` | Intégrer DndContext, SortableContext, useSortable, handler onDragEnd |

Aucune migration SQL requise.

