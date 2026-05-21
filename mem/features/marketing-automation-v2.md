---
name: Marketing Automation v2 (Lot 14)
description: Lot 14 — Géo+rôle targeting, A/B variants, métriques conversion, cron horaire process-automation
type: feature
---

# Lot 14 — Marketing Automation v2

Étend `marketing-automation-onboarding` (13 workflows J0-J30) avec :

## Ciblage avancé
- `automation_workflows.condition_countries text[]` (filtre `residence_country`)
- `automation_workflows.condition_cities text[]` (filtre `residence_city`)
- `automation_workflows.condition_roles text[]` (jointure `user_roles`)
- Front (hook `use-automation`) ET edge function `process-automation` appliquent ces filtres

## A/B Testing (2 variants max)
- Flags `ab_test_enabled` + `ab_split_percent` sur `automation_workflows`
- Table `automation_workflow_variants` (label 'A'/'B', UNIQUE workflow_id+label)
  contient overrides popup/push/email
- RPC `assign_automation_variant(workflow, user, anon)` :
  hash déterministe `hashtext(uid|wf) % 100 < split → A sinon B`
- RPC `get_automation_content(workflow, variant)` : merge JSON (variant override workflow)
- Tracking : `automation_user_progress.assigned_variant`,
  `automation_events.variant_label`, propagé dans `track-automation-click` (param `v`)

## Métriques de conversion
- Vue `v_automation_metrics` (security_invoker) groupée par workflow + variant :
  displays, clicks, dismissals, conversions, ctr_percent, conversion_percent
- À consommer dans `AdminAutomationAnalyticsTab` (déjà existant)

## Cron horaire
- pg_cron job `process-automation-hourly` (`5 * * * *`) appelle l'edge function
- ⚠️ **Prod** : recréer sur Supabase perso `vpt...yxf` avec URL + anon key prod
  (le job créé sur Lovable Cloud ne migre pas tout seul)

## Vue publique enrichie
- `automation_workflows_public` étendue avec colonnes ciblage + AB flags
  (sans contenu sensible push/email — sécurité v4.2 préservée)

## Composants UI
- `AutomationPopup.tsx` lit `variant` du hook et utilise `c.title/content/image/cta`
- `use-automation.ts` retourne `{ matchedWorkflow, variant, loading, recordDisplay }`
  où `recordDisplay(id, variant)` log `event_type='displayed'` avec variant
- `AdminAutomationsTab` à enrichir (sprint suivant) : onglet Variant B + bouton
  "Activer A/B" + métriques par variant

## Migrations
- `supabase/migrations/20260427230650_*.sql` (schéma + RPC + cron)
- `supabase/migrations/20260427230823_*.sql` (vue publique enrichie)
- Export prod : `/mnt/documents/zandofy_lot14_marketing_automation_v2.sql`
