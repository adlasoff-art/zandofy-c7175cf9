# Auth settings (fluid vs strict + discovery)

Key: `platform_settings.auth_settings`

```json
{
  "mode": "fluid",
  "collect_phone_on_signup": true,
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
    "rotation_hours": 12
  },
  "discovery_popup_delay_sec": 15
}
```

| Mode | App behavior | Supabase Dashboard |
|------|----------------|-------------------|
| `fluid` | After signup, if session exists → redirect immediately; optional phone on profile | **Confirm email** should be OFF (or auto-confirm) so `signUp` returns a session |
| `strict` | Toast « vérifiez votre e-mail »; optional checkout gate if `gate_checkout_on_email_confirm` | Confirm email ON |

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

Staging first, then production. Mirror Confirm email between projects when switching mode.
