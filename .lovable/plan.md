

# Correction des icônes PWA — fichiers réels

## Diagnostic

Le manifest JSON est correct (icônes séparées, screenshots, shortcuts). Les 5 échecs PWA Builder viennent tous de la même cause :

| Échec | Cause réelle |
|---|---|
| IconTypesAreValid (REQUIRED) | `icon-192.png` est un JPEG renommé en .png |
| IconSizesAreValid | `icon-192.png` fait 2000x2000 au lieu de 192x192 |
| ShortcutIconTypesAreValid | Même fichier icon-192.png |
| ShortcutIconSizesAreValid | Même fichier icon-192.png |
| ScreenshotTypesAreValid | `icon-512.png` est aussi un JPEG renommé |
| ScreenshotSizesAreValid | `icon-512.png` fait 2000x2000 au lieu de 512x512 |

## Changement

Regénérer les 2 fichiers d'icônes à partir du fichier source 2000x2000 existant :

- `frontend/public/icons/icon-192.png` — redimensionné à 192x192, converti en vrai PNG
- `frontend/public/icons/icon-512.png` — redimensionné à 512x512, converti en vrai PNG

Utilisation de ImageMagick pour convertir et redimensionner. Le fichier source sera lu depuis le serveur de production.

## Éléments optionnels (non bloquants)

Les échecs "Feature" (file_handlers, launch_handler, share_target, widgets, etc.) sont des fonctionnalités avancées optionnelles. Ils n'empêchent pas le packaging APK. Je ne les implémente pas sauf si tu le demandes.

Le Service Worker non détecté est un faux négatif — PWA Builder ne le trouve pas car il s'enregistre côté client via JavaScript. Cela ne bloque pas le packaging.

## Impact

- Aucun changement de code
- Aucune migration SQL
- Seuls 2 fichiers images remplacés
- Le manifest reste identique

## Fichiers modifiés

- `frontend/public/icons/icon-192.png` — regénéré en vrai PNG 192x192
- `frontend/public/icons/icon-512.png` — regénéré en vrai PNG 512x512

