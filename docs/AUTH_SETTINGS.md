# Auth settings (fluid vs strict + discovery)

Key: `platform_settings.auth_settings`

```json
{
  "mode": "fluid",
  "collect_phone_on_signup": true,
  "magic_link_enabled": false,
  "address_onboarding_enabled": true,
  "gate_checkout_on_email_confirm": false,
  "discovery_onboarding_enabled": true,
  "discovery_onboarding_steps": { "payment": true, "receipt": true },
  "discovery_mix": {
    "core_pct": 65,
    "explore_pct": 25,
    "neutral_pct": 10,
    "city_pct": 45,
    "country_within_core_pct": 20,
    "rotation_hours": 12,
    "intl_cap_pct": 10
  },
  "discovery_popup_delay_sec": 15
}
```

| Mode | App behavior | Supabase Dashboard |
|------|----------------|-------------------|
| `fluid` | After signup, if session exists → redirect to `/account` (or `?redirect=`); optional phone as identifier | **Confirm email** should be OFF (or auto-confirm) so `signUp` returns a session |
| `strict` | Toast « vérifiez votre e-mail »; optional checkout gate if `gate_checkout_on_email_confirm` | Confirm email ON |

## Auth UI (conversion)

| Surface | Behavior |
|---------|----------|
| Modes | **Google** + **email OR phone** + password |
| `magic_link_enabled` | Default **false** — hides “Connexion rapide OTP” |
| Phone-only | Synthetic email `digits@users.zandofy.internal` + `profiles.phone` + `email_is_placeholder` |
| Login phone | Edge Function `resolve-auth-identifier` → then `signInWithPassword` |
| Forgot password | Real email only |

## Discovery

| Key | Role |
|-----|------|
| `discovery_onboarding_enabled` | Kill-switch soft sheet Accueil |
| `discovery_onboarding_steps` | Toggle payment / receipt steps |
| `discovery_mix` | Feed ratios (must sum core+explore+neutral ≈ 100) |
| `discovery_popup_delay_sec` | Delay CMS announcement after discovery complete/dismiss |

See `docs/DISCOVERY_ENGINE.md`.

Admin UI: Settings → « Authentification clients ».

**RLS:** `auth_settings` must be in the public-read allowlist. Without it, clients only see code defaults.

## Ops checklist (staging → prod)

1. Run migration `20260921180000_auth_guest_conversion.sql`
2. Deploy Edge Function `resolve-auth-identifier` (`verify_jwt = false`)
3. Confirm email **OFF** when `mode: fluid`
4. Smoke: guest cart visible → checkout auth; signup email; signup phone; Google → `/account`

Staging first, then production. Mirror Confirm email between projects when switching mode.
