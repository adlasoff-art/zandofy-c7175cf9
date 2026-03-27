# Zandofy — Charte de Protection & Politiques de Sécurité

> **Version** : 1.0  
> **Date** : 2026-03-27  
> **Objectif** : Définir les règles que l'IA (Lovable) doit respecter AVANT toute modification du code, pour prévenir les régressions, les pannes et les failles de sécurité en production.

---

## 1. Principe Fondamental

**Ne jamais casser ce qui fonctionne.**

Avant chaque modification, l'IA DOIT :
1. Identifier tous les composants et fichiers impactés directement ET indirectement.
2. Évaluer le risque de régression sur les fonctionnalités existantes.
3. Signaler tout risque détecté à l'utilisateur AVANT d'agir.
4. Proposer des alternatives sûres si le risque est élevé.

---

## 2. Règles d'Impact — Analyse Obligatoire

### 2.1 Avant toute modification, répondre à ces questions :

| Question | Action si OUI |
|----------|---------------|
| Ce fichier est-il importé par d'autres composants ? | Lister TOUS les fichiers dépendants et vérifier la compatibilité |
| Cette modification touche-t-elle au Header, Footer, Layout ou Navigation ? | ⚠️ ALERTE CRITIQUE — ces composants sont visibles sur TOUTES les pages |
| Cette modification ajoute/supprime une colonne DB ou un champ d'API ? | Vérifier que TOUTES les requêtes existantes restent compatibles |
| Cette modification change un import, un export ou une signature de fonction ? | Vérifier tous les consommateurs de ce module |
| Cette modification touche aux styles globaux (index.css, tailwind.config) ? | Vérifier l'impact visuel sur l'ensemble du site |

### 2.2 Composants Critiques — Zone Rouge

Les fichiers suivants ont un impact sur **100% des pages**. Toute modification nécessite une vigilance maximale :

- `Header.tsx` et tous ses sous-composants (MegaMenu, CategoryBanner, NotificationCenter, SearchBar)
- `Footer.tsx`
- `Layout.tsx` / `AppLayout.tsx`
- `AuthContext.tsx` / `AuthProvider`
- `App.tsx` (routes)
- `index.css` (styles globaux)
- `tailwind.config.ts`
- `vite.config.ts`
- `supabase/client.ts` (auto-généré, NE PAS TOUCHER)

### 2.3 Composants Sensibles — Zone Orange

- Services API (`services/api.ts`, hooks de données)
- Composants de paiement et checkout
- Système de rôles et permissions (RoleGuard, use-roles)
- Gestion du panier (CartContext, cart_items)
- Pages admin (tout le dossier `admin/`)

---

## 3. Règles de Sécurité

### 3.1 Failles à détecter systématiquement

| Type de faille | Vérification |
|----------------|-------------|
| Données sensibles exposées | Jamais de mot de passe, clé API, email ou téléphone dans le code client |
| RLS manquante | Toute nouvelle table DOIT avoir des politiques RLS |
| Injection XSS | Tout HTML dynamique DOIT être sanitisé via DOMPurify |
| Escalade de privilèges | Les rôles sont vérifiés côté serveur (RLS + has_role), jamais côté client uniquement |
| Secrets en clair | Aucun secret dans le code source — utiliser les secrets Supabase |

### 3.2 Signalement obligatoire

Si l'IA détecte une faille de sécurité existante ou potentielle, elle DOIT :
1. La signaler immédiatement, même si ce n'est pas lié à la tâche en cours.
2. Proposer une correction.
3. Ne pas la masquer ou l'ignorer.

---

## 4. Règles de Compatibilité Base de Données

### 4.1 Requêtes résilientes

- Ne JAMAIS supposer qu'une colonne existe en production sans vérifier le schéma.
- Utiliser des colonnes explicites dans les `SELECT` (pas de `SELECT *`).
- Si une colonne est ajoutée dans une migration, les requêtes doivent fonctionner AVEC ET SANS cette colonne jusqu'au déploiement confirmé.
- Tester les requêtes contre le schéma de production connu.

### 4.2 Migrations

- Les migrations doivent être idempotentes (`IF NOT EXISTS`, `IF EXISTS`).
- Ne jamais supprimer une colonne utilisée par du code en production.
- Documenter l'impact de chaque migration sur le code frontend.

---

## 5. Règles de Modification de Code

### 5.1 Principe de moindre impact

- Modifier le MINIMUM de fichiers nécessaires pour la tâche.
- Ne JAMAIS refactorer un fichier non lié à la tâche en cours.
- Ne JAMAIS changer un import, un nom de variable ou une signature de fonction "en passant".

### 5.2 Isolation des dépendances

- Les nouveaux composants utilisant des librairies tierces (Radix, Leaflet, etc.) doivent être chargés en lazy-loading si leur échec peut impacter des composants critiques.
- Utiliser des Error Boundaries autour des composants à risque.
- Un composant qui plante ne doit JAMAIS faire planter la navigation ou le layout.

### 5.3 Tests mentaux obligatoires

Avant de valider une modification, l'IA doit mentalement vérifier :
- [ ] La page d'accueil s'affiche-t-elle correctement ?
- [ ] Le menu et les catégories sont-ils visibles ?
- [ ] L'authentification fonctionne-t-elle ?
- [ ] Le panier fonctionne-t-il ?
- [ ] Les pages admin sont-elles accessibles aux admins ?

---

## 6. Protocole de Communication

### 6.1 Alertes obligatoires

L'IA DOIT avertir l'utilisateur dans les cas suivants :

| Situation | Format d'alerte |
|-----------|----------------|
| Risque de régression détecté | ⚠️ **RISQUE** : [description] — Composants impactés : [liste] |
| Faille de sécurité détectée | 🔴 **SÉCURITÉ** : [description] — Recommandation : [action] |
| Incohérence de données/schéma | 🟡 **INCOHÉRENCE** : [description] — État production vs développement |
| Modification d'un composant Zone Rouge | 🔴 **ZONE ROUGE** : Modification de [fichier] — Impact : toutes les pages |
| Action irréversible | 🔴 **IRRÉVERSIBLE** : [description] — Confirmation requise |

### 6.2 Format de proposition

Pour toute tâche à risque, proposer :
1. **Ce que je vais faire** : description claire
2. **Ce que ça impacte** : liste des fichiers et fonctionnalités
3. **Risques identifiés** : liste des régressions possibles
4. **Plan de mitigation** : comment minimiser les risques
5. **Alternative sûre** : approche moins risquée si disponible

---

## 7. Fichiers Interdits

Ces fichiers ne doivent JAMAIS être modifiés sans approbation explicite :

- `docker-compose.yaml`, `docker-compose.prod.yml`
- `backend/Dockerfile`, `frontend/Dockerfile`
- `src/integrations/supabase/client.ts` (auto-généré)
- `src/integrations/supabase/types.ts` (auto-généré)
- `.env` (auto-géré)
- `.cursor/rules/*`
- `AGENTS.md`

---

## 8. Checklist Pré-Déploiement

Avant de finaliser toute modification :

- [ ] Aucun `console.log` de debug laissé dans le code
- [ ] Aucune donnée sensible exposée
- [ ] Les imports sont tous résolus (pas de module manquant)
- [ ] Les requêtes DB utilisent des colonnes qui existent en production
- [ ] Les composants critiques (Header, Footer, Nav) fonctionnent
- [ ] Les Error Boundaries sont en place pour les composants à risque
- [ ] Les politiques RLS sont définies pour les nouvelles tables
- [ ] Le build TypeScript passe sans erreur

---

## 9. Leçons Apprises (Post-Mortems)

### Incident 2026-03-27 : Disparition des catégories et du menu
- **Cause** : Requête utilisant `sort_order` (colonne absente en production) → erreur 400 → crash silencieux du Header
- **Impact** : Navigation invisible sur toutes les pages pendant plusieurs jours
- **Leçon** : Toujours vérifier la compatibilité des requêtes avec le schéma de production
- **Règle ajoutée** : Les requêtes doivent fonctionner même si une colonne récente est absente (§4.1)

---

> Ce document est vivant. Il sera enrichi après chaque incident ou découverte de risque.  
> L'IA doit le consulter mentalement avant chaque tâche de modification.
