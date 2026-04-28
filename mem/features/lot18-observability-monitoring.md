---
name: Lot 18 Observability Monitoring
description: Système de surveillance temps réel (healthchecks, incidents, alertes) avec page /admin/health et widget compact sur AdminDashboard
type: feature
---

# Lot 18 — Observabilité & Monitoring

## Composants

- **Tables** : `health_checks` (historique 30j), `health_incidents` (auto-ouvert/fermé, dédupliqué via index unique sur composant ouvert), `cron_heartbeats` (1 ligne par job), `monitoring_settings` (singleton id=1).
- **Vue** : `v_system_health` (security_invoker, agrégation 24h : uptime%, latence moyenne, dernier statut).
- **RPC** : `record_cron_heartbeat(job_name, status, error, interval)` — chaque cron job doit l'appeler à chaque tick.
- **Edge Function** : `run-healthchecks` (Deno + nodemailer) — exécutée toutes les 5 min via pg_cron.
  - Vérifie : KelPay (`https://api.kelpay.cd/`), 7 EFs critiques (process-automation, notify-order-status, kelpay-webhook, process-dispute-sla, process-vendor-analytics-emails, send-vendor-email, track-shipment-17track), SMTP Hostinger (transporter.verify()), heartbeats des crons (down si > 2× intervalle attendu).
  - Auto-crée incidents (severity warn ou critical), auto-ferme si statut redevient ok.
  - Envoie alertes email + push aux admins (table notifications) sur **nouveaux** incidents seulement (anti-spam).

## Frontend

- **Hook** `use-system-health` : `useSystemHealth`, `useHealthIncidents`, `useCronHeartbeats`, `useGlobalHealthStatus` (refetchInterval 60s).
- **Widget** `SystemHealthWidget` : carte compacte avec feu vert/orange/rouge en tête de `/admin` (AdminDashboard), lien vers `/admin/health`.
- **Banner** `HealthAlertBanner` : bandeau rouge persistant en haut de tout AdminLayout tant qu'un incident critique est ouvert. Dismissible localement.
- **Page** `/admin/health` (4 onglets) : Vue d'ensemble (table uptime/latence), Incidents (ouverts + clôture manuelle + historique), Cron jobs (ticks + erreurs), Réglages (toggles canaux, seuils, destinataires).

## Sidebar

Section Système → "Santé système" (icône Activity), entre "Rapports d'erreurs" et "Journal d'audit".

## Configuration

- Seuils par défaut : KelPay 8000ms, EF 5000ms, taux d'échec 10%.
- Canaux par défaut : email + push + banner activés.
- Destinataires email : champ libre (CSV) à renseigner dans /admin/health → Réglages.
- `enabled = false` désactive complètement le système.

## Cron jobs ajoutés (côté DB prod)

- `run-healthchecks-5min` : `*/5 * * * *` → POST `/functions/v1/run-healthchecks`
- `cleanup-health-checks-daily` : `0 3 * * *` → purge > 30j

## Déploiement prod (vpt...yxf)

1. Appliquer `zandofy_lot18_observability.sql` (remplacer URL + anon key).
2. Push GitHub → GitHub Actions déploie l'EF `run-healthchecks` (+ deno.json).
3. Configurer dans /admin/health → Réglages : destinataires email d'alerte.

## Notes

- La capture d'erreurs frontend reste basée sur la table `error_reports` existante (Lot précédent) : ErrorBoundary + window.onerror + unhandledrejection avec rate limit 5/min et fallback REST keepalive. Aucune extension nécessaire.
- L'alerte push utilise la table `notifications` standard (type=`system_alert`, link=`/admin/health`).
- Pour ajouter un nouveau cron à surveiller : appeler `record_cron_heartbeat('mon-job', 'ok', null, 30)` à la fin de chaque exécution. Il apparaîtra automatiquement dans `/admin/health → Cron jobs`.
