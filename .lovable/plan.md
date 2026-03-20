

# Enrichissement Complet du Profil Utilisateur & Outils Admin

## Problème critique : Perte des données de profil

**Cause identifiée** : La fonction `ensureProfile` dans `AuthContext.tsx` exécute un `upsert` à **chaque connexion/rafraîchissement de session**. Elle écrase `first_name` et `last_name` avec les métadonnées auth (souvent `null` pour les comptes email/password). Résultat : les noms saisis manuellement disparaissent.

**Correction** : Transformer l'upsert en INSERT conditionnel — ne mettre à jour que si le profil n'existe pas encore, et ne jamais écraser les champs déjà renseignés.

---

## Plan en 7 phases

### Phase 1 — Corriger la persistance du profil (critique)

Modifier `AuthContext.tsx` : remplacer l'upsert aveugle par un `INSERT ... ON CONFLICT DO NOTHING` ou un check préalable. Les champs `first_name`/`last_name` ne seront plus écrasés si déjà renseignés en base.

### Phase 2 — Enrichir le schéma `profiles` (migration SQL)

Ajouter les colonnes manquantes :

| Colonne | Type | Description |
|---------|------|-------------|
| `nationality` | text | Nationalité du client |
| `residence_address` | text | Adresse de résidence |
| `residence_city` | text | Ville de résidence |
| `last_known_lat` | double precision | Latitude GPS |
| `last_known_lng` | double precision | Longitude GPS |
| `last_known_geo_at` | timestamptz | Date du dernier relevé GPS |
| `preferred_language` | text (default 'fr') | Langue préférée |
| `preferred_contact_channel` | text (default 'chat') | Canal de contact favori |
| `last_login_at` | timestamptz | Dernière connexion |
| `login_count` | int (default 0) | Nombre de connexions |
| `display_id` | serial | ID incrémental lisible |

### Phase 3 — Méthodes de paiement Mobile Money

Créer la table `payment_methods` :
- `id`, `user_id`, `provider` (mpesa/airtel/orange), `phone_number`, `label`, `is_default`, `created_at`
- RLS : chaque utilisateur ne voit/gère que ses propres méthodes
- Afficher les méthodes sauvegardées dans le profil et les pré-remplir au checkout

### Phase 4 — Limiter les adresses selon le statut KYC

- Non vérifié : max 2 adresses
- Vérifié (KYC approuvé) : max 5 adresses
- Vérification côté frontend ET via une fonction RLS/check au backend
- Ajout d'un champ `document_number` et `document_expiry` à `kyc_verifications`
- Ajout d'un champ `confidence_score` (numeric) à `kyc_verifications`

### Phase 5 — Enrichir la vue Admin des utilisateurs

Modifier `AdminUsersPage.tsx` et `UserDetailDrawer.tsx` pour afficher :
- **ID incrémental** (`display_id`) dans la liste
- **Statistiques d'activité** : date inscription, dernière connexion, nombre de commandes, taux d'annulation
- **Localisation GPS** avec indicateur de cohérence vs adresse déclarée
- **Note moyenne vendeur→client** (nouveau système de notation bidirectionnelle)
- **Badge utilisateur** (fiable, premium, etc.) basé sur les métriques
- **Préférences** : langue, canal de communication favori
- **KYC** : type de pièce, numéro, expiration, score de confiance, date de vérification
- **Méthodes de paiement** enregistrées
- **Historique des logs** (connexions, changements de profil, IP, device)

### Phase 6 — Logs d'activité et analyse comportementale

Créer la table `user_activity_logs` :
- `id`, `user_id`, `action` (login, profile_update, search, page_view, etc.), `metadata` (jsonb — IP, device, search terms, etc.), `created_at`
- Enregistrer les connexions, changements de profil, recherches produits
- Emplacement réservé pour l'analyse IA via Edge Function (appel ChatGPT/Lovable AI à la demande pour scorer les risques, segmenter les clients, détecter les comportements suspects)

### Phase 7 — Préparation de l'impersonation admin

Créer une Edge Function `impersonate-user` :
- Réservée aux admins (vérification du rôle via `has_role`)
- Génère un token temporaire limité en lecture seule pour voir l'interface "comme le client"
- Audit log obligatoire de chaque session d'impersonation
- Les managers pourront y accéder uniquement si l'admin leur accorde le droit

**Note** : L'impersonation complète nécessite le `service_role_key` et sera implémentée via Edge Function sécurisée, pas en frontend.

---

## Détail technique

### Fichiers modifiés

| Fichier | Action |
|---------|--------|
| `frontend/src/contexts/AuthContext.tsx` | Fix `ensureProfile` — ne plus écraser les champs existants |
| Migration SQL | Ajout colonnes `profiles`, table `payment_methods`, table `user_activity_logs`, colonnes `kyc_verifications` |
| `frontend/src/pages/DashboardPage.tsx` | Ajouter nationalité, adresse résidence, méthodes de paiement, GPS au profil |
| `frontend/src/pages/admin/AdminUsersPage.tsx` | Afficher `display_id`, stats, GPS, badge |
| `frontend/src/components/admin/UserDetailDrawer.tsx` | Enrichir avec toutes les sections (KYC, logs, paiement, activité, notation) |
| `frontend/src/pages/DashboardPage.tsx` (AddressesTab) | Limiter à 2/5 adresses selon KYC |
| Edge Function `impersonate-user` | Impersonation sécurisée |
| Edge Function `ai-user-analysis` | Emplacement pour analyse IA comportementale |

### Notation vendeur→client (nouveau)

Créer la table `customer_ratings` :
- `id`, `order_id`, `store_id`, `customer_id`, `vendor_id`, `rating` (1-5), `comment`, `created_at`
- Le vendeur note le client après livraison
- Moyenne affichée dans le profil admin

### Consentements RGPD

Ajouter à `profiles` :
- `notifications_enabled` (boolean, default true)
- `gdpr_consent_at` (timestamptz)
- `allowed_channels` (text[] — sms, email, whatsapp, push)

---

## Résumé des priorités

1. **Immédiat** : Fix `ensureProfile` (perte de données)
2. **Immédiat** : Migration schéma + nationalité + display_id
3. **Court terme** : Payment methods, limites adresses, enrichissement admin
4. **Moyen terme** : Logs d'activité, notation vendeur→client, badges
5. **Planifié** : Impersonation, analyse IA comportementale

> ⚠️ Vu l'ampleur, je recommande d'implémenter en 2-3 passes. La première passe couvre les phases 1-4 (fix critique + schéma + profil enrichi). La seconde passe couvre les phases 5-7 (admin avancé + logs + impersonation).

