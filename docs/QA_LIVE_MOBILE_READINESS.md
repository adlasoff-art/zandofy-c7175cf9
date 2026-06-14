# Checklist QA — Lives mobile & recherche image

Utiliser cette checklist sur **staging** avant chaque live TikTok / formation.

## Navigation produit (mobile)

- [ ] Accueil → scroll milieu de page → ouvrir un produit
- [ ] Bouton **Retour** visible sous le header (mobile uniquement)
- [ ] Retour ramène à l’accueil **à la même position de scroll**
- [ ] Logo Zandofy renvoie toujours vers `/` (inchangé)
- [ ] Drawer variantes (bottom sheet) et bottom nav fonctionnent après retour

## Catégorisation admin

- [ ] `/admin/product-categories` : filtrer « Chaussures » + « sur catégorie parente »
- [ ] Déplacer 1 produit test vers une sous-catégorie
- [ ] Vérifier apparition dans `/category/<sous-cat>` côté client

## Recherche visuelle (toggle OFF par défaut)

- [ ] Admin → Paramètres : toggle recherche visuelle **OFF** → pas de bouton caméra
- [ ] Lancer indexation → compteurs `ready` augmentent (~940 images principales)
- [ ] Secrets Supabase : `EMBEDDING_API_KEY` (Hugging Face) + `OPENAI_API_KEY` (fallback)

## Recherche visuelle (toggle ON — démo live)

- [ ] Activer toggle → bouton caméra visible
- [ ] Photo d’un produit catalogue → 1er résultat = produit attendu (`search_mode: vector_exact`)
- [ ] Photo hors catalogue → fallback mots-clés acceptable
- [ ] Désactiver toggle après le live

## Déploiement requis

1. Migration SQL `20260604120000_product_image_embeddings_pgvector.sql` sur Supabase
2. Push `develop` → edge functions + frontend Vercel
3. Vault Supabase : `project_url` + `service_role_key` (index auto à la publication)
