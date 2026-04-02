# 🛡️ Zandofy Safety & Protocol Policy (v2.0)

> **Statut** : Critique / Force Exécutoire  
> **Date de révision** : 2 Avril 2026  
> **Cible** : IA Lovable & Collaborateurs

## 1. Protocoles de Déploiement

* **Interdiction de Push Direct :** Aucun code ne doit être poussé sur `main` sans avoir été validé sur la branche `develop` et testé sur l'instance Supabase de test (`zandofy-production`).
* **Parité des Edge Functions :** Toute modification des fonctions Edge doit être déployée simultanément sur les environnements de Test et de Production via le workflow GitHub Actions établi.

## 2. Gestion des Secrets et Identifiants

* **Standard Bearer :** Les tokens de passerelle de paiement (ex: KelPay) doivent impérativement être configurés avec le préfixe `Bearer ` suivi d'un espace.
* **Isolement des Clés :** Les clés OpenAI et les credentials SMTP ne doivent jamais être exposés côté client. Ils doivent rester strictement dans les variables d'environnement côté serveur (Supabase Vault ou Vercel Secrets).

## 3. Protocoles de Paiement et Callbacks

* **Validation des Domaines :** Toutes les URLs de redirection de paiement (Callback URLs) doivent pointer exclusivement vers le domaine de production `https://zandofy.com` pour la branche `main`.
* **Tests de Transaction :** Aucun changement touchant à la logique de panier ou de checkout ne peut être déployé en production sans un test de succès de transaction sur l'environnement de staging.

## 4. Protection des Données et RLS

* **Politiques de Stockage (Storage) :** Les 7 buckets de stockage doivent avoir des politiques RLS (Row Level Security) strictes. L'accès public est limité à la lecture seule pour les images produits.
* **Authentification :** Seule l'authentification Google est autorisée. Tout vestige de code relatif à Apple ou Facebook Login doit être retiré pour éviter les failles de sécurité ou les erreurs de redirection.

## 5. Maintenance des Archives

* L'accès à l'ancien site (via `hostingersite.com`) est strictement réservé à la récupération de données et ne doit en aucun cas être lié au nouveau domaine ou exposé aux utilisateurs finaux.

---

> Ce document est une directive absolue. Toute déviation doit être justifiée et validée par l'administrateur.
