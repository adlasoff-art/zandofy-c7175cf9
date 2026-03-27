# Zandofy — Charte de Haute Disponibilité & Sécurité (V2.0)

> **Statut** : Critique / Force Exécutoire  
> **Date de révision** : 27 Mars 2026  
> **Cible** : IA Lovable & Collaborateurs  
> **Objectif** : Garantir la stabilité et la sécurité de la plateforme pour un usage en production à grande échelle.

---

## 1. Classification de Gravité (Incident Severity)

Avant toute intervention, l'IA doit classifier la nature de sa tâche :

* **P0 (Critique)** : Interruption totale du service, faille de sécurité majeure (fuite de données), ou corruption de la base de données.
* **P1 (Majeur)** : Dégradation d'une fonctionnalité clé (Paiement, Login, Panier) alors que le site reste accessible.
* **P2 (Standard)** : Évolutions mineures, corrections de bugs d'interface (UI/UX), ou optimisations.

---

## 2. Analyse d'Impact & "Blast Radius" (Rayon d'Action)

### 2.1 Protocoles de Zone

| Zone | Composants | Règle de Modification |
| :--- | :--- | :--- |
| **Zone ROUGE** | Header, Footer, Layout, AuthContext, App.tsx, `supabase/client.ts` (auto-généré, NE PAS TOUCHER), `index.css`, routes globales | **INTERDICTION** de modifier sans un plan de Rollback explicite. Impact global (100% des pages). |
| **Zone ORANGE** | Checkout, API Services, Admin, Rôles/Permissions, CartContext, Hooks de données | Isolation obligatoire par `Error Boundaries`. Impact sur les revenus ou l'administration. |
| **Zone VERTE** | Pages statiques, Composants isolés, Pages de contenu | Modification standard après vérification des dépendances directes. |

### 2.2 Analyse Pré-Modif (Mandatoire)

1. **Dépendances** : Identifier tous les composants qui importent le fichier modifié.
2. **Effet Cascade** : Si ce composant échoue, le Layout principal doit-il survivre ? → OUI obligatoirement.
3. **Schéma DB** : Vérifier que les colonnes utilisées existent en production.

---

## 3. Sécurité de Niveau Industriel

### 3.1 Protection des Données (Privacy by Design)

* **Zéro PII en clair** : Aucun email, téléphone ou donnée personnelle ne doit être exposé dans les logs client ou les attributs HTML.
* **Sanitisation** : Utilisation de DOMPurify pour tout contenu HTML dynamique afin de prévenir les failles XSS.
* **Validation Stricte** : Utiliser des schémas (type Zod) pour valider chaque entrée utilisateur avant traitement.

### 3.2 Contrôle d'Accès (Zero Trust)

* **RLS (Row Level Security)** : Toute nouvelle table de base de données DOIT avoir des politiques RLS définies.
* **IDOR Prevention** : Vérifier systématiquement que l'accès à une ressource est lié à l'ID de l'utilisateur (`auth.uid()`) côté serveur.
* **Rôles** : Les rôles sont vérifiés côté serveur (RLS + `has_role`), jamais côté client uniquement.
* **Secrets** : Aucun secret dans le code source — utiliser les secrets backend.

---

## 4. Standard de Base de Données & Résilience

### 4.1 Compatibilité Ascendante (Backward Compatibility)

* **Requêtes Résilientes** : Ne jamais utiliser `SELECT *`. Lister explicitement les colonnes requises.
* **Graceful Handling** : Le code doit fonctionner même si une colonne récemment ajoutée est absente du schéma de production (prévention de l'erreur 400).

### 4.2 Migrations Idempotentes

* Utiliser systématiquement `IF NOT EXISTS` ou `IF EXISTS` dans les scripts SQL.
* Ne jamais supprimer une colonne active sans une phase de dépréciation validée.
* Documenter l'impact de chaque migration sur le code frontend.

---

## 5. Standard de Développement (Production Ready)

### 5.1 Robustesse logicielle

* **Lazy Loading** : Obligatoire pour les bibliothèques tierces lourdes afin de ne pas bloquer le rendu initial.
* **Circuit Breaker** : Si un service externe est indisponible, afficher un état dégradé au lieu de faire planter le composant.
* **Error Boundaries** : Obligatoires autour des composants à risque. Un composant qui plante ne doit JAMAIS faire planter la navigation ou le layout.

### 5.2 Principe de moindre impact

* Modifier le MINIMUM de fichiers nécessaires pour la tâche.
* Ne JAMAIS refactorer un fichier non lié à la tâche en cours.
* Ne JAMAIS changer un import, un nom de variable ou une signature de fonction "en passant".

### 5.3 Checklist Pré-Déploiement

- [ ] Aucun `console.log` de debug laissé dans le code
- [ ] Aucune donnée sensible exposée
- [ ] Les imports sont tous résolus (pas de module manquant)
- [ ] Les requêtes DB utilisent des colonnes qui existent en production
- [ ] Les composants critiques (Header, Footer, Nav) fonctionnent
- [ ] Les Error Boundaries sont en place pour les composants à risque
- [ ] Les politiques RLS sont définies pour les nouvelles tables
- [ ] Le build TypeScript passe sans erreur

---

## 6. Protocole de Communication (RFC)

Pour toute modification impactant les zones Rouge ou Orange, l'IA doit fournir :

1. **Scope** : Description technique précise.
2. **Impact** : Liste des composants et fonctionnalités potentiellement affectés.
3. **Risques** : Scénarios de régression possibles.
4. **Plan de Mitigation** : Mesures prises (ex: ajout d'Error Boundary, fallback).
5. **Validation Mentale** : Confirmation que le Header, le Panier et l'Auth restent opérationnels.

### 6.1 Alertes Obligatoires

| Situation | Format |
|-----------|--------|
| Risque de régression | ⚠️ **RISQUE** : [description] — Composants impactés : [liste] |
| Faille de sécurité | 🔴 **SÉCURITÉ** : [description] — Recommandation : [action] |
| Incohérence de données | 🟡 **INCOHÉRENCE** : [description] |
| Zone Rouge touchée | 🔴 **ZONE ROUGE** : Modification de [fichier] — Impact : toutes les pages |
| Action irréversible | 🔴 **IRRÉVERSIBLE** : [description] — Confirmation requise |

---

## 7. Fichiers Interdits (No-Fly Zone)

Ces fichiers ne doivent JAMAIS être modifiés sans approbation explicite :

* `src/integrations/supabase/client.ts` (auto-généré)
* `src/integrations/supabase/types.ts` (auto-généré)
* `.env` (auto-géré)
* `docker-compose.yaml`, `docker-compose.prod.yml`
* `backend/Dockerfile`, `frontend/Dockerfile`
* `AGENTS.md`, `.cursor/rules/*`

---

## 8. Leçons Apprises (Post-Mortems)

### Incident 2026-03-27 : Disparition des catégories et du menu
- **Cause** : Requête utilisant `sort_order` (colonne absente en production) → erreur 400 → crash silencieux du Header
- **Impact** : Navigation invisible sur toutes les pages pendant plusieurs jours
- **Leçon** : Toujours vérifier la compatibilité des requêtes avec le schéma de production
- **Règle ajoutée** : Les requêtes doivent fonctionner même si une colonne récente est absente (§4.1)

---

> Ce document est une directive absolue. Toute déviation doit être justifiée et validée par l'administrateur.  
> Ce document est vivant. Il sera enrichi après chaque incident ou découverte de risque.
