# Audit senior — Forwarder TMS (post-implémentation)

Date: 2026-09-16

## Verdict

Implémentation globalement alignée avec le plan, **mais plusieurs failles / bugs critiques** trouvés et corrigés avant exécution SQL staging.

## Findings corrigés (P0 / P1)

| Sévérité | Problème | Correction |
|----------|----------|------------|
| **P0 Sécurité** | Owner pouvait `UPDATE` une demande membre vers `approved` (RLS WITH CHECK trop large) | Policy: owner ne peut que passer à `cancelled` |
| **P0 Sécurité** | Mot de passe envoyé en clair par email | Emails sans secret ; mdp affiché une fois au owner UI |
| **P0 Sécurité** | Owner pouvait reset le mdp d’un compte préexistant (prise de contrôle) | Colonne `password_managed_by_owner` ; reset refusé sinon |
| **P0 Sécurité** | Approbation attachait un compte existant sans consentement | Refuse si email déjà enregistré → email dédié collaborateur |
| **P0 Bug** | Retrait wallet sans débit de `available_balance` | RPC `request_forwarder_withdrawal` (FOR UPDATE + débit atomique) |
| **P1 Race** | Crédit wallet check-then-insert | Ledger d’abord (unique index) puis bump solde |
| **P1 UX/AuthZ** | Ops voyait nav Équipe / Portefeuille / Paramètres | Nav filtrée `ownerOnly` / `financeOnly` |
| **P1 Tracking** | Photos publiques fragile (signed URL seule) | Fallback `download` + message d’erreur |

Migration: `20260916223000_forwarder_audit_harden.sql`

## Risques acceptés / hors scope (documentés)

- **Statuts custom** : hors vague.
- **Facturation réelle des sièges payants** : config admin seule (pas d’encaissement auto).
- **Crédit sur `shipping_payment_status=paid` par défaut** : garanti par exigence d’un `forwarder_handoffs` + montant > 0 (pas de crédit local sans handoff).
- **Multi-legs / multi-forwarders** : crédit sur le 1er handoff non cancelled (à raffiner si legs multi-forwarder deviennent courants).
- **Recovery link magic** : non implémenté ; owner set password + « mot de passe oublié » suffisent.

## Smoke checklist post-SQL

1. Owner ne peut pas approuver sa propre demande membre via SQL client.
2. Admin approve avec email neuf → membre `password_managed_by_owner=true` → set password OK.
3. Admin approve email existant → 409.
4. Créer retrait → solde diminue ; double-soumission impossible sous-solde.
5. Commande avec handoff + shipping paid → 1 crédit ledger unique.
6. Ops : pas de liens wallet/team/settings ; finance : wallet visible.
7. `/t/:token` photos si présentes.
