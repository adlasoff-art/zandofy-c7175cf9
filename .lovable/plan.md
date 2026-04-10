

# Plan : Ajout de Google Analytics dans img-src de la CSP

## Constat

La CSP dans `frontend/index.html` ligne 47 contient déjà :
- **script-src** : `https://www.googletagmanager.com https://www.google-analytics.com` — OK
- **connect-src** : `https://www.google-analytics.com https://www.googletagmanager.com` — OK
- **img-src** : `https://www.googletagmanager.com` — manque `https://www.google-analytics.com`

## Correction

| Fichier | Changement |
|---------|-----------|
| `frontend/index.html` ligne 47 | Ajouter `https://www.google-analytics.com` après `https://www.googletagmanager.com` dans la section `img-src` |

Cela permettra à Google Analytics d'envoyer ses pixels de tracking (balises `<img>`) sans être bloqué par la CSP. Aucun autre changement nécessaire — le reste est déjà en place.

