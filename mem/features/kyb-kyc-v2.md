---
name: KYB/KYC v2 — Vérification vendeurs (Lot 15)
description: Système v2 de vérification entreprise (RCCM/ID/adresse/NIF/RIB) avec scoring auto, revue admin manuelle, bucket privé kyb-documents
type: feature
---
**Lot 15.** Cohabite avec `AdminKycPage` legacy (ne le remplace pas).

Tables: `kyb_submissions`, `kyb_documents`, `kyc_submissions`, `kyb_audit_log`. Enum `kyc_status_v2` (l'enum `kyc_status` legacy a `not_started/pending/approved/rejected/resubmission_required`).

Bucket privé `kyb-documents`, path `{user_id}/{submission_id}/{filename}`, accès via signed URL (300s). RLS : vendeur owner_id voit/édite ses soumissions en draft/rejected/needs_changes ; admin/manager voient tout.

Scoring auto (trigger BEFORE UPDATE) : 50 pts infos + 10 pts par doc requis (RCCM/ID/adresse/NIF/RIB). Soumission bloquée si score <80 ou docs manquants.

Décision admin = manuelle (pas d'OCR/IA). Audit log pour chaque approve/reject/needs_changes.

UI : `VendorKybV2Tab` (onglet "Vérification KYB" dashboard vendeur), `AdminKybKycV2Page` (route `/admin/kyb-kyc-v2`, sidebar admin "KYB / KYC v2"). Hook `use-kyb-kyc-v2.ts`.
