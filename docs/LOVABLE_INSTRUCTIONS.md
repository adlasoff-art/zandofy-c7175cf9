# Instructions pour Lovable

Ce document contient le texte à copier-coller ou à communiquer à Lovable pour cadrer son travail. Utilisez-le comme base à chaque nouvelle feature.

**Pour une première mise en alignement (Lovable découvre le monorepo actuel)** : utilisez **docs/LOVABLE_PHASE1_ALIGNMENT.md**. C’est le bon point de départ avant de configurer GitHub, staging et production.

---

## Prompt de base à donner à Lovable

```
Tu travailles sur Zandofy, une plateforme e-commerce multi-vendeurs.

Contexte :
- Un seul dépôt GitHub : tout le code (frontend, backend, migrations) est dans le même repo.
- Tu produis le frontend (React, TypeScript, Vite).
- Le backend FastAPI et l'intégration sont gérés par une autre étape.
- Ton travail sera poussé sur GitHub, puis déployé via Coolify.

Scope autorisé :
- Tu peux modifier : frontend/src, frontend/components, frontend/pages, frontend/hooks, frontend/lib
- Tu peux créer des migrations Supabase si je te le demande explicitement
- Tu peux créer ou modifier des Edge Functions Supabase si je te le demande explicitement

Scope interdit :
- Ne modifie PAS : docker-compose.yaml, docker-compose.prod.yml, backend/Dockerfile, frontend/Dockerfile
- Ne modifie PAS : domaines, ports, variables d'environnement existantes
- Ne modifie PAS : AGENTS.md, .cursor/rules/, docs/ (sauf si explicitement demandé)
- Ne renomme PAS de variables VITE_* ou autres
- N'invente PAS de nouveaux noms de domaines ou d'URLs

Contraintes techniques :
- Garde les variables VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID, VITE_API_URL telles quelles (elles sont configurées par environnement)
- Si ta feature nécessite une nouvelle variable d'environnement, indique-le clairement au lieu de la modifier
- Si ta feature nécessite un changement backend ou DB, indique-le clairement pour que ce soit traité en aval

Environnements (pour référence, ne pas modifier) :
- Staging : studio-staging.zandofy.com, api-staging.zandofy.com, supabasa-staging.zandofy.com
- Production : zandofy.com, api.zandofy.com, supabasa.zandofy.com
```

---

## Ce que Lovable doit faire

- Générer du code frontend (UI, composants, pages, hooks)
- Respecter les conventions React/TypeScript existantes
- Proposer des migrations SQL ou des Edge Functions **uniquement si demandé explicitement**
- Indiquer clairement les dépendances backend, DB ou env

## Ce que Lovable ne doit pas faire

- Toucher aux fichiers de déploiement
- Modifier les domaines, ports ou variables d'environnement
- Inventer une architecture parallèle
- Pusher sans que le code ait été revu et intégré

## Workflow Lovable → GitHub → Cursor → Coolify

1. Tu donnes à Lovable une demande cadrée (objectif, scope, interdictions).
2. Lovable génère le code frontend.
3. Le code est poussé sur une branche feature ou develop.
4. Cursor AI (dans le même repo) revoit, intègre, corrige, ajoute backend si besoin.
5. Merge vers develop.
6. Coolify staging déploie develop.
7. Validation humaine sur staging.
8. Merge vers main.
9. Coolify production déploie main.

Lovable et Cursor travaillent dans **le même dépôt GitHub**. Tout est centralisé.
