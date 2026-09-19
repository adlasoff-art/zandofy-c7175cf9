# Auth settings (fluid vs strict)

Key: `platform_settings.auth_settings`

```json
{
  "mode": "fluid",
  "collect_phone_on_signup": true,
  "address_onboarding_enabled": true,
  "gate_checkout_on_email_confirm": false
}
```

| Mode | App behavior | Supabase Dashboard |
|------|----------------|-------------------|
| `fluid` | After signup, if session exists → redirect immediately; optional phone on profile | **Confirm email** should be OFF (or auto-confirm) so `signUp` returns a session |
| `strict` | Toast « vérifiez votre e-mail »; optional checkout gate if `gate_checkout_on_email_confirm` | Confirm email ON |

Admin UI: Settings → section « Authentification clients ».

**RLS:** `auth_settings` must be in the public-read allowlist (`20260919140000_auth_settings_public_read.sql`). Without it, clients only see code defaults and admin toggles appear to do nothing.

Staging first, then production. Mirror Confirm email between projects when switching mode.
