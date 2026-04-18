

## Plan — Mémoriser définitivement la stack de production prioritaire

### Objectif
Inscrire dans la mémoire projet (Core + fichier dédié) que **toutes les corrections doivent cibler en priorité la stack de production GitHub → Vercel → Supabase.com personnel**, et que **Lovable Cloud n'est qu'un environnement de preview**, jamais la source de vérité.

### Ce que je vais faire (mode default)

**1. Mettre à jour `mem://index.md` (Core)**
Ajouter une règle Core en tête, visible à chaque action :
> **Stack de production prioritaire** : GitHub (`main`) → Vercel (`zandofy.com`) → Supabase.com personnel. Toute correction cible d'abord cette stack. Lovable Cloud (`uogkklwfvwoxkifpkzpu`) = preview uniquement, jamais source de vérité. Sous-domaines `studio.zandofy.com` et `supabasa.zandofy.com` = supprimés/obsolètes.

**2. Mettre à jour `mem://architecture/environment-database-separation`**
Réécrire pour refléter l'état réel :
- Production = Supabase.com personnel (project ID fourni par l'utilisateur, à ne pas afficher en chat)
- Lovable Cloud = preview/dev seulement
- Retirer toute mention de `studio.zandofy.com` / `supabasa.zandofy.com`

**3. Mettre à jour `mem://architecture/deployment-workflow-sop`**
Renforcer : edge functions et migrations doivent être déployées via le workflow GitHub Actions vers le Supabase de prod. Lovable ne déploie que sur Lovable Cloud (preview).

**4. Créer `mem://constraint/production-priority-rule`** (type constraint)
Règle absolue : ne jamais raisonner ou corriger sur la base des données Lovable Cloud quand le bug concerne la prod. Toujours considérer que la vraie DB est sur Supabase.com personnel et que les tests directs côté Lovable peuvent donner des faux négatifs (UUID introuvables, etc.).

**5. Mettre à jour `mem://project/technical-identifiers`**
Préciser que :
- Domaine prod : `zandofy.com` uniquement
- Stack : GitHub + Vercel + Supabase.com (compte personnel)
- Lovable project ID = uniquement pour preview Lovable
- Ne jamais confondre les deux

### Ce que je ne ferai pas
- Aucune modification de code applicatif
- Aucun déploiement
- Aucune migration DB
- Aucun changement aux fichiers `.env`, `client.ts`, ou edge functions

### Risques
Aucun. Mises à jour de mémoire uniquement.

### Validation
Après exécution, à chaque future demande de correction, je raisonnerai automatiquement dans le bon référentiel (prod GitHub/Vercel/Supabase.com) et je n'irai plus tester sur Lovable Cloud comme si c'était la vérité.

