# Smoke production — checklist

Dernière vérification automatisée : HTTP 200 sur `https://www.zandofy.com/` (redirige vers `https://zandofy.com/`).

## À contrôler manuellement (2 min)

- [ ] Accueil : une seule zone titre principal (H1 sr-only), sections visibles
- [ ] Fiche produit : une balise `<title>`, pas de galerie dupliquée
- [ ] Réseau (DevTools) : images catalogue en `.../render/image/...?width=` quand URL Supabase Storage
- [ ] Hero : preload dynamique (pas d’Unsplash fixe dans le HTML initial)

## Commande locale (optionnel)

```powershell
Invoke-WebRequest -Uri "https://www.zandofy.com/" -UseBasicParsing | Select-Object StatusCode
```
