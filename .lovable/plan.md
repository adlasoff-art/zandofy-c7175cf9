

# Plan : Mise à jour de `robots.txt`

Ajouter les deux lignes Sitemap demandées dans `frontend/public/robots.txt`. La ligne statique existante sera conservée (elle est identique à la première demandée), et la ligne dynamique (Edge Function production) sera ajoutée.

## Fichier modifié

| Fichier | Changement |
|---------|-----------|
| `frontend/public/robots.txt` | Ajouter `Sitemap: https://vpttoqojmiqxgudknyxf.supabase.co/functions/v1/generate-sitemap` après la ligne Sitemap existante |

Le fichier contiendra donc les deux entrées Sitemap pointant vers le sitemap statique et le sitemap dynamique.

