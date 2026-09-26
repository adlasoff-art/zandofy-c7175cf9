# Launch ops checklist (I0) — staging puis production

Exécuter **avant** le pic pubs. Ordre : staging → validation courte → **même étapes en production**.

## 1. Supabase Auth

- [ ] **Confirm email = OFF** (Authentication → Providers → Email)
- [ ] Même réglage sur staging et production

Sans cela, le mode `fluid` ne renvoie pas de session après `signUp`.

## 2. `platform_settings.auth_settings`

Vérifier / upsert JSON :

```json
{
  "mode": "fluid",
  "collect_phone_on_signup": true,
  "magic_link_enabled": false,
  "address_onboarding_enabled": true,
  "gate_checkout_on_email_confirm": false,
  "discovery_onboarding_enabled": true,
  "discovery_onboarding_steps": { "payment": true, "receipt": true },
  "discovery_popup_delay_sec": 30
}
```

- [ ] `mode` = `fluid`
- [ ] `gate_checkout_on_email_confirm` = `false`
- [ ] `discovery_popup_delay_sec` ≥ 30  
  Si la clé existe déjà avec `15`, **mettre à jour** le JSON (le code ne force pas l’overwrite DB).
- [ ] Clé lisible côté anon (RLS allowlist `auth_settings`)

## 3. Migrations SQL (si pas déjà appliquées)

Ordre :

1. `20260921180000_auth_guest_conversion.sql` (si manquant)
2. `20260924140000_vendor_submit_require_kyc.sql`
3. `20260924150000_vendor_submit_multistore_gate.sql`
4. `20260924160000_checkout_sessions_and_group_policy.sql`
5. `20260924170000_checkout_sessions_no_client_update.sql`
6. `20260924180000_group_checkout_default_multi_vendor.sql`

Vérifs :

```sql
SELECT group_checkout_policy, count(*) FROM stores GROUP BY 1;
-- Attendu: quasi tout multi_vendor_ok

SELECT tgname FROM pg_trigger WHERE tgname = 'trg_vendor_app_require_kyc';
-- Attendu: 1 row
```

- [ ] Staging OK
- [ ] Production OK

## 4. Edge Functions

- [ ] `resolve-auth-identifier` déployée (login téléphone)
- [ ] Si lot checkout sessions pas encore live : `kelpay-payment`, `kelpay-webhook`, `kelpay-check`, `keccel-cardpay`

## 5. Done I0

Cocher uniquement après smoke court staging + mêmes checks prod. Voir [LAUNCH_SMOKE.md](./LAUNCH_SMOKE.md).
