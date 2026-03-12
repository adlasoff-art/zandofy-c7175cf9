# Zandofy — Architecture Stack (V2)

## Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────┐
│                        UTILISATEURS                              │
│                    (navigateur / PWA)                             │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE (CDN + WAF)                         │
│                                                                  │
│  • DNS (proxy ON)         • Cache statique (assets, images)      │
│  • DDoS / WAF             • Règles de sécurité (Rate Limiting)   │
│  • SSL terminaison        • Page Rules / Cache Rules             │
│  • Bot Management         • Compression (Brotli)                 │
│                                                                  │
│  Domaines :                                                      │
│    zandofy.com  →  Vercel (CNAME)                                │
│    cdn.zandofy.com  →  Cloudflare R2 (custom domain)             │
└──────────────────────┬──────────────────┬────────────────────────┘
                       │                  │
            ┌──────────▼──────┐   ┌───────▼────────────┐
            │                 │   │                     │
            │    VERCEL       │   │  CLOUDFLARE R2      │
            │  (Frontend)     │   │  (Object Storage)   │
            │                 │   │                     │
            │  • React SPA    │   │  • Images produits  │
            │  • Vite build   │   │  • Médias CMS       │
            │  • Static only  │   │  • Documents        │
            │  • Edge Network │   │  • Factures PDF     │
            │  • Zero SSR     │   │  • Chat media       │
            │                 │   │  • Compatible S3    │
            └────────┬────────┘   └────────────────────┘
                     │
                     │  SDK JS (supabase-js)
                     │  Auth JWT + REST + Realtime
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                       SUPABASE                                   │
│                  (Backend-as-a-Service)                           │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐      │
│  │   Auth      │  │  PostgreSQL  │  │  Edge Functions    │      │
│  │             │  │              │  │  (Deno runtime)    │      │
│  │  • Email    │  │  • 50+ tables│  │                    │      │
│  │  • OAuth    │  │  • RLS       │  │  • Paiement KelPay │      │
│  │  • JWT      │  │  • Triggers  │  │  • Webhooks        │      │
│  │  • MFA      │  │  • Functions │  │  • Emails SMTP     │      │
│  │             │  │  • Realtime  │  │  • AI (Gemini/GPT) │      │
│  └─────────────┘  └──────────────┘  └────────────────────┘      │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐                               │
│  │  Realtime   │  │  Cron Jobs   │                               │
│  │             │  │  (pg_cron)   │                               │
│  │  • Messages │  │              │                               │
│  │  • Notifs   │  │  • Expiry    │                               │
│  │  • Tracking │  │  • Release   │                               │
│  │             │  │  • Cleanup   │                               │
│  └─────────────┘  └──────────────┘                               │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                       HOSTINGER                                  │
│                   (Domain Registrar)                              │
│                                                                  │
│  • Enregistrement domaine zandofy.com                            │
│  • NS pointés vers Cloudflare                                    │
│  • Gestion DNS déléguée à Cloudflare                             │
└──────────────────────────────────────────────────────────────────┘
```

## Responsabilités par service

| Service        | Responsabilité                        | Coût estimé (10M users) |
|----------------|---------------------------------------|------------------------|
| **Vercel**     | Hébergement SPA statique uniquement   | ~$20/mois (Pro)        |
| **Supabase**   | Auth, DB, Edge Functions, Realtime    | ~$75-300/mois (Pro+)   |
| **Cloudflare** | CDN, WAF, DDoS, DNS proxy, R2 storage| ~$20-50/mois           |
| **Hostinger**  | Domaine uniquement                    | ~$10/an                |
| **SMTP**       | Emails transactionnels (externe)      | Variable               |

## Flux de données

### 1. Page load
```
Utilisateur → Cloudflare CDN → Vercel Edge → SPA (React)
```

### 2. Requête API (données)
```
SPA → supabase-js SDK → Supabase REST/Realtime → PostgreSQL
```

### 3. Upload fichier
```
SPA → Supabase Storage (ou Cloudflare R2 via presigned URL)
```

### 4. Paiement
```
SPA → Supabase Edge Function → KelPay API → Webhook → Edge Function
```

## Variables d'environnement (Vercel)

```
VITE_SUPABASE_URL=https://uogkklwfvwoxkifpkzpu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbG...
VITE_SUPABASE_PROJECT_ID=uogkklwfvwoxkifpkzpu
```

> ⚠️ Aucune variable backend (DATABASE_URL, JWT_SECRET, etc.) ne doit être sur Vercel.

## Migration future vers FastAPI

Ce schéma est conçu pour permettre une migration progressive :

1. **Phase actuelle** : Supabase Edge Functions pour la logique métier
2. **Phase future** : Remplacer les Edge Functions par un backend FastAPI sur Render/self-hosted
3. **Changement requis** : Ajouter `VITE_API_URL` et migrer les appels SDK vers `api-client.ts`

Le code `frontend/src/services/api-client.ts` est déjà prêt pour cette transition.

## Sécurité

- **Cloudflare WAF** : Protection DDoS, rate limiting, bot management
- **Supabase RLS** : Row Level Security sur toutes les tables
- **JWT** : Tokens signés par Supabase Auth
- **CORS** : Configuré dans Supabase dashboard
- **CSP** : Headers configurés dans vercel.json
- **R2** : Accès via presigned URLs ou bucket public contrôlé
