

# Fix déploiement GitHub Actions — `submit-sourcing-request` orpheline

## Diagnostic

Le job GitHub Actions échoue parce que `frontend/supabase/config.toml` (ligne 70) déclare :
```toml
[functions.submit-sourcing-request]
verify_jwt = true
```
…mais le dossier `frontend/supabase/functions/submit-sourcing-request/` n'existe pas. Le CLI Supabase essaie de bundler tout ce qui est déclaré → erreur fatale → tout le déploiement (~21 fonctions) est annulé.

**Bonne nouvelle** : cette fonction n'est utilisée nulle part. Le formulaire client (`SourcingRequestForm.tsx`) écrit directement dans Supabase via le SDK, protégé par :
- la RLS sur `product_sourcing_requests`
- le trigger serveur `enforce_sourcing_rate_limit` (max 5/jour)
- les policies Storage par dossier `{user_id}/`

La défense est déjà serveur-side. La fonction Edge n'apporte rien.

## Correctif (option retenue : suppression de la déclaration orpheline)

**Un seul fichier à modifier** :

### `frontend/supabase/config.toml`
Retirer le bloc lignes 70-71 :
```diff
- [functions.submit-sourcing-request]
- verify_jwt = true
```

Garder les 3 autres blocs (`notify-sourcing-response`, `cleanup-sourcing`, `sourcing-email-digest`) — ils ont bien leur fichier `index.ts`.

### Pourquoi pas créer la fonction à la place ?
- Aucun appel `supabase.functions.invoke("submit-sourcing-request")` dans le code.
- Le rate-limit est déjà serveur (trigger BEFORE INSERT).
- Le bucket est privé avec RLS par `auth.uid()`.
- Ajouter une Edge Function dupliquerait la logique sans gain de sécurité.

## Vérification post-fix

Après le merge sur `main`, le workflow `deploy-edge-functions.yml` redéploiera proprement les ~21 fonctions, dont les 3 sourcing existantes.

## Note prod

Côté `supabase/config.toml` racine (Lovable Cloud), la déclaration orpheline existe peut-être aussi — à retirer également pour rester cohérent et éviter le même échec si un déploiement Cloud est tenté.

## Détails techniques

**Fichiers modifiés** :
- `frontend/supabase/config.toml` (retrait bloc `[functions.submit-sourcing-request]`)
- `supabase/config.toml` (idem si présent — à vérifier)

**Aucune migration SQL, aucun changement de comportement runtime.** Le feature sourcing reste 100 % fonctionnel.

