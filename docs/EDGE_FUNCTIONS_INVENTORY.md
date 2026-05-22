# Inventaire Edge Functions (lot G5)

## Source de vérité Git

Déployer **uniquement** depuis [`supabase/functions/`](../supabase/functions/).

Le dossier [`frontend/supabase/`](../frontend/supabase/) est **déprécié** (copie Lovable historique). Ne plus y modifier ni déployer.

**CI** : [`.github/workflows/deploy-edge-functions.yml`](../.github/workflows/deploy-edge-functions.yml) déploie depuis la **racine** du repo (`supabase/functions/`), pas depuis `frontend/`.

## Fonctions versionnées dans Git (racine)

| Fonction | Rôle indicatif |
|----------|----------------|
| admin-users | Gestion utilisateurs admin |
| ai-user-analysis | Analyse IA utilisateur |
| ai-recommendations | Recommandations IA |
| apply-dispute-refund | Remboursements litiges |
| calculate-shipping | Calcul frais de port |
| cleanup-sourcing | Nettoyage sourcing |
| expire-pending-orders | Expiration commandes en attente |
| generate-invoice | Factures |
| generate-shipping-labels | Étiquettes expédition |
| generate-sitemap | Sitemap XML dynamique |
| get-store-whatsapp | WhatsApp boutique |
| impersonate-user | Impersonation admin (audit log) |
| keccel-cardpay / kelpay-* | Paiements |
| notify-* | Notifications commandes / sourcing / points |
| operator-* / request-* | Opérateurs / couverture |
| platform-bootstrap | Bootstrap plateforme |
| process-automation* | Automations |
| push-notifications | Web push |
| send-email / send-vendor-email | Emails |
| share-proxy | Partage |
| subscribe-payment | Abonnements |
| track-* | Tracking colis / automations |
| vendor-order-webhook | Webhook commande vendeur |
| verify-confirmation-code | Codes confirmation |
| visual-search | Recherche visuelle |
| watermark-image | Filigrane images |

## Déploiement

1. Modifier le code sous `supabase/functions/<name>/`.
2. Déployer vers **staging** Supabase, tester.
3. Déployer vers **production**.
4. Le workflow [`.github/workflows/deploy-edge-functions.yml`](../.github/workflows/deploy-edge-functions.yml) se déclenche sur push `main`/`develop` si `supabase/functions/**` change.

## Alignement Dashboard ↔ Git

Beaucoup de fonctions **operator / forwarder / admin** existent en prod mais ne sont pas toutes listées ci-dessus : elles ont pu être créées directement dans le Dashboard Lovable.

**Procédure** : comparer la liste Dashboard production avec ce fichier ; pour chaque fonction prod critique, vérifier qu’une copie existe sous `supabase/functions/` ou planifier une importation.

## Migrations SQL

Toujours [`supabase/migrations/`](../supabase/migrations/) — jamais `frontend/supabase/migrations/`.
