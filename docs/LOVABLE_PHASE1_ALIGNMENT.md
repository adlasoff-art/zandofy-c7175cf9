# Phase 1 : Aligner Lovable sur le monorepo actuel

Ce document sert de **première étape réaliste** : faire en sorte que Lovable travaille dans le bon contexte (monorepo, structure actuelle, déploiement Coolify) et que ce qu’il génère soit facile à intégrer. Une fois cette phase faite, on enchaîne sur GitHub (branches, staging, production).

---

## Objectif de la Phase 1

- Lovable **connaît** la structure réelle du projet (monorepo avec `frontend/`, `backend/`, déploiement Coolify).
- Lovable **génère** du code qui va dans `frontend/` sans casser le reste.
- Tu peux **donner ce prompt à Lovable** tel quel ou l’adapter.
- Si Lovable se trompe, tu **corriges** (ou tu me passes le résultat pour que j’harmonise).
- Ensuite seulement : configuration GitHub, staging, production.

---

## Prompt « Première définition » à donner à Lovable

Copie-colle ce bloc à Lovable (au début d’une session ou quand tu (re)connectes le projet). Tu peux ajouter en dessous ta demande de feature du jour.

```
Tu travailles sur Zandofy, plateforme e-commerce multi-vendeurs.

Structure du projet (monorepo) :
- Le dépôt contient à la racine : frontend/, backend/, docker-compose.yaml, AGENTS.md, docs/
- Le frontend est dans frontend/ : React, TypeScript, Vite, Supabase client. C’est la seule partie que tu modifies.
- Le backend est dans backend/ : FastAPI. Tu ne le modifies pas.
- Le déploiement se fait via Coolify à partir de ce même dépôt (docker-compose, Dockerfiles). Tu ne modifies pas les fichiers de déploiement.

Ce que tu dois faire :
- Générer ou modifier du code uniquement dans frontend/src (pages, components, hooks, lib, services, contexts) ou dans frontend/supabase/ si je te le demande explicitement (migrations, Edge Functions).
- Utiliser les variables d’environnement existantes : VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID, VITE_API_URL. Ne pas les renommer ni en inventer d’autres sans que je te le demande.
- Si une feature nécessite un changement backend, une nouvelle variable ou une migration, indique-le clairement dans ta réponse au lieu de le faire toi-même.

Ce que tu ne dois pas faire :
- Ne pas modifier : docker-compose.yaml, backend/Dockerfile, frontend/Dockerfile, AGENTS.md, .cursor/, docs/
- Ne pas changer les noms de domaines ou d’URLs (ils sont gérés par environnement : staging vs production).
- Ne pas toucher à la configuration Vite (vite.config.ts) sauf si je te demande explicitement une modification précise.

Objectif : ton code doit pouvoir être poussé dans ce dépôt et déployé sans casser le build ni le déploiement. Une autre étape (Cursor / humain) s’occupe de l’intégration backend et du déploiement.
```

Ensuite, ajoute ta demande concrète, par exemple :
- « Conforme-toi à cette structure. Prochaine feature : [description]. »
- Ou : « Vérifie que le projet frontend utilise bien VITE_API_URL pour les appels API et ne modifie rien d’autre. »

---

## Ce que Lovable peut faire concrètement (réaliste)

| Action | Possible ? | Détail |
|--------|------------|--------|
| Générer du code dans `frontend/src/` | Oui | Pages, composants, hooks, services, contexts. C’est son cœur de métier. |
| Respecter la structure existante | Oui | Si tu lui décris le monorepo (comme dans le prompt ci-dessus). |
| Créer une migration Supabase | Oui, si demandé | Dans `frontend/supabase/migrations/`. À demander explicitement. |
| Créer / modifier une Edge Function | Oui, si demandé | Dans `frontend/supabase/functions/`. À demander explicitement. |
| Pousser vers GitHub | Dépend de Lovable | Si Lovable est connecté au repo, il peut push. Sinon, tu récupères le code (export/copie) et tu le mets dans le repo toi-même. |
| Ne pas toucher Docker / env / docs | Oui | Si le prompt est clair et que tu relis ce qu’il propose. |
| S’aligner sur l’API backend existante | Oui | En utilisant `VITE_API_URL` et en ne renommant pas les variables. |

En pratique : Lovable **génère du frontend** dans le bon dossier et **évite tout ce qui est déploiement / env / racine**. Le reste (backend, Coolify, branches) est géré après.

---

## Ce dont Cursor a besoin pour bien harmoniser

Pour que je puisse intégrer et déployer sans casse, il me faut :

1. **Code frontend dans `frontend/`**  
   Pas de code backend mélangé, pas de fichiers à la racine (sauf si on en a décidé ensemble).

2. **Variables d’env inchangées**  
   Pas de nouveau nom du type `VITE_MON_URL` sans qu’on l’ait décidé. Si une nouvelle variable est nécessaire, Lovable doit le **dire** dans sa réponse, pas la créer à la place des existantes.

3. **Pas de modification des fichiers sensibles**  
   - `docker-compose.yaml`, `docker-compose.prod.yml`  
   - `backend/Dockerfile`, `frontend/Dockerfile`  
   - `vite.config.ts` sauf demande explicite  
   - `AGENTS.md`, `docs/`, `.cursor/`

4. **Dépendances backend / DB explicites**  
   Si une feature a besoin d’un nouvel endpoint, d’une migration ou d’une variable, que Lovable le **liste** dans sa réponse. Je m’occupe du backend / migrations / env.

5. **Structure des dossiers respectée**  
   - `frontend/src/pages/`, `frontend/src/components/`, etc.  
   - Pas de nouveau dossier bizarre à la racine ou dans `backend/` pour du code frontend.

Si Lovable respecte ça, je peux aligner, corriger et préparer staging/production sans conflits.

---

## Comment utiliser ce prompt

1. **Ouvre Lovable** et, si possible, connecte-le au dépôt GitHub du projet (même repo que celui où Cursor travaille).
2. **Copie le prompt « Première définition »** ci-dessus et colle-le en tout début de conversation (ou dans la description du projet si Lovable le permet).
3. **Ajoute ta demande** (feature, correction, vérification).
4. **Récupère le résultat** : soit Lovable pousse sur le repo, soit tu exportes/copies le code dans le dépôt.
5. **Vérifie** : pas de modification dans `docker-compose`, Dockerfiles, `AGENTS.md`, `docs/`, variables renommées.
6. Si quelque chose ne va pas : **tu corriges** ou tu me passes le diff / les fichiers et je te propose les corrections.
7. Quand tu es satisfait, on passe à l’étape suivante : **configuration GitHub (branches, staging, production)**.

---

## Résumé

- **Phase 1** = aligner Lovable sur le monorepo actuel avec le prompt ci-dessus.
- **Lovable** = génère du frontend dans `frontend/`, ne touche pas au déploiement ni aux env.
- **Toi** = tu donnes le prompt, tu vérifies, tu corriges ou tu me passes le résultat.
- **Moi (Cursor)** = j’harmonise, j’intègre backend/env si besoin, puis on enchaîne sur GitHub + Coolify (staging, production).

Une fois cette phase claire et utilisée une fois, on peut enchaîner sur la configuration précise du dépôt (branches, protection, Coolify staging/production).
