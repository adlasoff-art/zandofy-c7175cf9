

# Upload toujours accessible + limite 3 Mo

## Aucune migration nécessaire
Les changements sont 100% frontend. Le bucket `chat-media` et les tables `messages`/`conversations` existent déjà. Rien à toucher côté base de données.

## Problème actuel
Le bouton d'upload (📎) n'apparaît que si `chat_media_enabled` est activé sur la boutique. Un client qui veut envoyer une image ne voit même pas le bouton. La limite est à 5 Mo.

## Changements prévus

### 1. Bouton d'upload toujours visible pour le client
Dans `InternalChat.tsx` et `ChatPanel.tsx` : retirer la condition `mediaEnabled` qui masque le bouton 📎. Le bouton sera toujours présent dans la zone de saisie. Le paramètre `mediaEnabled` reste utile côté vendeur (pour d'éventuelles restrictions futures) mais ne bloque plus l'affichage du bouton.

### 2. Limite à 3 Mo
Passer `MAX_FILE_SIZE` de `5 * 1024 * 1024` à `3 * 1024 * 1024` dans les deux fichiers. Mettre à jour les messages d'erreur en conséquence ("3 Mo" au lieu de "5 Mo").

### 3. UX mobile optimisée
- Le bouton 📎 reste compact (w-9 h-9), bien cliquable au pouce
- `accept="image/*,application/pdf"` permet la sélection depuis galerie ou caméra sur mobile
- Une seule pièce à la fois (déjà le cas, `<input>` sans `multiple`)
- Tooltip adapté : "Joindre une image ou un PDF (max 3 Mo)"

## Fichiers modifiés
| Fichier | Changement |
|---|---|
| `frontend/src/components/InternalChat.tsx` | Bouton upload inconditionnel, limite 3 Mo |
| `frontend/src/components/messages/ChatPanel.tsx` | Bouton upload inconditionnel, limite 3 Mo |

## Risque
Faible. Le bucket `chat-media` accepte déjà les uploads. On retire juste une condition d'affichage et on réduit la taille max.

