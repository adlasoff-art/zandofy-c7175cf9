

# Corrections UX mobile + QR code étiquettes

## Problème 1 — Bouton X caché derrière la barre de statut (Chat, Support, Couleurs produit)

Le bouton de fermeture (X) des composants `Sheet` et `Dialog` utilise `top-4` (16px) comme position. Sur les téléphones modernes avec encoche/barre de statut épaisse, ce bouton se retrouve sous la zone système.

### Solution

Modifier les deux composants UI de base pour respecter la zone de sécurité iOS/Android :

**`frontend/src/components/ui/sheet.tsx`** — Changer le close button de `top-4` à `top-[max(1rem,env(safe-area-inset-top,1rem))]` et ajouter `pt-[env(safe-area-inset-top)]` au conteneur SheetContent.

**`frontend/src/components/ui/dialog.tsx`** — Même correction sur le close button. Ajouter un padding-top safe-area sur mobile pour que le contenu ne soit pas masqué.

**`frontend/src/pages/MessagesPage.tsx`** — Remplacer `h-screen` par `h-[100dvh]` pour que la hauteur tienne compte de la barre d'adresse mobile et ajouter `pt-[env(safe-area-inset-top)]`.

**`frontend/src/components/messages/ChatPanel.tsx`** — Ajouter `pt-[env(safe-area-inset-top)]` au header sticky mobile pour le décaler sous la barre de statut.

**`index.html`** — Vérifier que `<meta name="viewport">` contient `viewport-fit=cover` (nécessaire pour que `env(safe-area-inset-*)` fonctionne).

## Problème 2 — QR code gêné par les lignes dans l'étiquette d'expédition

Les doubles séparateurs (lignes) sont collés au QR code en haut de l'étiquette, rendant le scan difficile.

### Solution

**`frontend/src/components/shipping/ShippingLabelPreview.tsx`** — Ajouter `mb-4` au bloc header (QR + VERYSPEED) pour créer un espace avant les séparateurs. Identique dans le HTML généré pour l'impression (`handlePrint`).

## Résumé des fichiers modifiés

| Fichier | Modification |
|---|---|
| `frontend/src/components/ui/sheet.tsx` | Safe-area padding + close button position |
| `frontend/src/components/ui/dialog.tsx` | Safe-area padding + close button position |
| `frontend/src/pages/MessagesPage.tsx` | `h-[100dvh]` + safe-area top |
| `frontend/src/components/messages/ChatPanel.tsx` | Safe-area top sur le header sticky |
| `frontend/src/components/shipping/ShippingLabelPreview.tsx` | Espacement QR code |
| `index.html` | `viewport-fit=cover` dans meta viewport |

## Risque

Faible. Les corrections CSS n'affectent que le positionnement mobile. Le fallback `env(safe-area-inset-top, 1rem)` assure la compatibilité avec les navigateurs qui ne supportent pas cette propriété.

