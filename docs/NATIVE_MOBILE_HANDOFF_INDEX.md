# Paquet documentation — continuité application mobile native

**Date :** 2026-09-30  
**Usage :** transmettre ce fichier **+** les MD listés ci-dessous à l’équipe Flutter / iOS / Android.

Document principal à lire en premier :

→ **[`NATIVE_MOBILE_HANDOVER.md`](./NATIVE_MOBILE_HANDOVER.md)**

---

## Contenu du paquet (copier / zip / partager)

### P0 — Obligatoire

| Fichier | Description |
|---------|-------------|
| `docs/NATIVE_MOBILE_HANDOVER.md` | Handoff complet web/PWA → natif (contrats, règles, checklist) |
| `docs/NATIVE_MOBILE_HANDOFF_INDEX.md` | Ce fichier (index du paquet) |
| `docs/ENVIRONMENTS.md` | Staging vs production Supabase / Vercel |
| `docs/AUTH_SETTINGS.md` | Modes auth fluid/strict, settings publiques |
| `docs/guides/GEO_COMMERCIAL_SCOPE.md` | Scope commercial, destinations, `except_cities`, RPC |
| `docs/guides/CHECKOUT_SESSIONS.md` | Sessions multi-boutiques, confirm Edge |
| `docs/OFF_PLATFORM_PAYMENT.md` | Paiement différé + release admin plateforme |
| `docs/VENDOR_PLANS_AND_FULFILLMENT_CONTRACT.md` | Plans, lanes, hub, **Contract RPC §8** |
| `docs/OPS_RUNBOOK_RELIABILITY.md` | Migrations + crons staging→prod |
| `docs/CHECKOUT_SMOKE_CHECKLIST.md` | 5 scénarios checkout |
| `docs/NATIVE_SYNC_FROM_WEB.md` | **Réponse web → mobile** (chrome, geo, poids, freight, **RLS stores vendeur**, KYB) |

### Contract RPC obligatoire (natif)

Consommer ces RPC plutôt que les colonnes legacy en lecture seule :

| RPC | Usage |
|-----|--------|
| `get_store_entitlements` | Features + quotas boutique |
| `get_checkout_vendor_payment_flags` | Modes paiement checkout |
| `preview_included_delivery_credit` | Aperçu crédit livraison Enterprise |
| `get_carrier_allowlist_ids` | Filtre forwarders / operators |
| `refresh_kyb_completeness_score` | Rescore KYB après upload |
| `assert_store_identity_ready` | Gate publish / identité |
| `try_consume_included_delivery` | Consommation crédit (post-order items) |

**Table `stores` (dashboard vendeur) :** préférer RPC `list_my_vendor_stores()` (`164000`) ; sinon SELECT + policy `Store team and staff read full store`. Catalog public = `stores_public` seulement.

Détail auth + signatures : `docs/VENDOR_PLANS_AND_FULFILLMENT_CONTRACT.md` §8.

### P1 — Fortement recommandé

| Fichier | Description |
|---------|-------------|
| `docs/I9_MARKETPLACE_MOBILE_SYNC.md` | Samples, RFQ, wallet, shortcuts commande |
| `docs/EDGE_FUNCTIONS_INVENTORY.md` | Liste Edge Functions déployables |
| `docs/ARCHITECTURE-STACK.md` | Stack Vercel + Supabase + Cloudflare |
| `docs/ARCHITECTURE.md` | Architecture produit (si présent / à jour) |
| `docs/DISCOVERY_ENGINE.md` | Algo discovery détaillé |
| `docs/STORE_PUBLIC_VISIBILITY_OPS.md` | Boutiques bannies / suspendues / archivées |
| `docs/PRODUCT_IMAGE_GUIDELINES.md` | Guidelines médias produits |
| `docs/PAYMENT_PROOF_DEPLOYMENT.md` | Preuves de paiement / storage |
| `docs/MOBILE_CHROME_ALIBABA.md` | Chrome mobile / patterns UI web (réf.) |

### P2 — Ops / confort / contexte

| Fichier | Description |
|---------|-------------|
| `docs/QA_LIVE_MOBILE_READINESS.md` | Readiness QA mobile |
| `docs/guides/TWA_APK.md` | TWA / APK (si pertinent) |
| `docs/guides/LAUNCH_SMOKE.md` | Smoke launch |
| `docs/guides/LAUNCH_OPS_CHECKLIST.md` | Checklist ops launch |
| `docs/SMOKE_PROD.md` | Smoke production |
| `docs/G4_SECURITY.md` | Sécurité |
| `docs/SAFETY_POLICY.md` | Politique sécurité projet |
| `docs/VAULT_SECRETS_HANDOFF.md` | Secrets (ops — ne pas mettre dans le binaire) |
| `docs/FORWARDER_TMS_*.md` | TMS transitaires (si app ship international) |
| `docs/MOIS_CA_OPS_CHECKLIST.md` | Ops Mois / CA |
| `docs/MEDIA_HARDENING_OPS_CHECKLIST.md` | Hardening médias |

### Code de référence (pas MD, mais à citer)

| Chemin | Pourquoi |
|--------|----------|
| `supabase/migrations/202609*.sql` | Contrats schéma récents |
| `supabase/functions/` | Edge Functions source of truth |
| `frontend/src/lib/auth-helpers.ts` | Email synthétique / phone |
| `frontend/src/components/BrandLogo.tsx` | Logo marque |
| `frontend/src/components/VendorProductManager.tsx` | Publish + exemption plateforme |
| `frontend/src/lib/off-platform-payment.ts` | Hors plateforme |
| `frontend/src/lib/discovery-prefs.ts` | Prefs discovery |
| `frontend/public/brand/zandofy-logo.webp` | Asset logo Z |

---

## Commande zip suggérée (depuis la racine du repo)

```bash
# PowerShell (Windows)
$files = @(
  "docs/NATIVE_MOBILE_HANDOVER.md",
  "docs/NATIVE_MOBILE_HANDOFF_INDEX.md",
  "docs/ENVIRONMENTS.md",
  "docs/AUTH_SETTINGS.md",
  "docs/guides/GEO_COMMERCIAL_SCOPE.md",
  "docs/guides/CHECKOUT_SESSIONS.md",
  "docs/OFF_PLATFORM_PAYMENT.md",
  "docs/DISCOVERY_MOBILE_HANDOFF.md",
  "docs/I9_MARKETPLACE_MOBILE_SYNC.md",
  "docs/EDGE_FUNCTIONS_INVENTORY.md",
  "docs/ARCHITECTURE-STACK.md",
  "docs/DISCOVERY_ENGINE.md",
  "docs/STORE_PUBLIC_VISIBILITY_OPS.md",
  "docs/PRODUCT_IMAGE_GUIDELINES.md",
  "docs/PAYMENT_PROOF_DEPLOYMENT.md",
  "docs/MOBILE_CHROME_ALIBABA.md",
  "docs/QA_LIVE_MOBILE_READINESS.md"
)
Compress-Archive -Path $files -DestinationPath "zandofy-mobile-handoff-docs.zip" -Force
```

Ou transmettre simplement le dossier `docs/` + pointer vers `NATIVE_MOBILE_HANDOVER.md`.

---

## Message type pour l’équipe mobile

> Voici le handoff web/PWA → natif. Commencez par `NATIVE_MOBILE_HANDOVER.md`, puis les docs P0 (auth, geo, checkout, off-platform, discovery).  
> Backend = mêmes projets Supabase staging/prod que le web ; migrations + Edge Functions uniquement à la racine `supabase/`.  
> Points non négociables : email synthétique téléphone, vues `*_public`, exemption `is_platform_owned` (identité + KYB), pas d’UPDATE client sur `checkout_sessions`, geo commercial scope, soft-delete ≠ email libre.

---

## Mises à jour

| Date | Note |
|------|------|
| 2026-09-30 | Création handoff + index après lots auth, geo, checkout, branding, publish plateforme |
