# WhatsApp Cloud API — configuration guide (Zandofy)

**Status:** Platform scaffolding is ready (`dispatch-outreach`, `whatsapp-cloud-send`, `whatsapp_cloud` templates).  
**Default:** Cloud sending is **OFF** until secrets + Meta templates + business number are validated.

Related:

- Migration: `supabase/migrations/20261001170000_outreach_utility_messages_foundation.sql`
- Admin: `/admin/notifications` → **Messages utilitaires**
- Manual wa.me: `/admin/users` → column **WA** (never automated)
- Edge: `dispatch-outreach`, `whatsapp-cloud-send`, `whatsapp-cloud-webhook`

---

## 1. Concepts (do not confuse)

| Mechanism | Auto server send? | Use |
|-----------|-------------------|-----|
| `wa.me` | **No** | Admin opens WhatsApp with prefilled text |
| WhatsApp **Cloud API templates** | **Yes** | Business-initiated utility/marketing (approved templates) |
| Free-form chat | Only inside ~24h after user writes | Support replies |

---

## 2. Meta Developers checklist

1. Go to [Meta for Developers](https://developers.facebook.com/) → your app (or create one).
2. Add product **WhatsApp**.
3. Link a **Meta Business Portfolio**.
4. Add / claim a **WhatsApp Business phone number** (test number first, then production).
5. Note:
   - **Phone number ID** → `WHATSAPP_CLOUD_PHONE_NUMBER_ID`
   - **WhatsApp Business Account ID** → `WHATSAPP_CLOUD_BUSINESS_ACCOUNT_ID`
   - Create a permanent **System User** access token with `whatsapp_business_messaging` → `WHATSAPP_CLOUD_TOKEN`
6. Create **message templates** (FR) whose **names** match `utility_message_templates.whatsapp_cloud_template_name`:
   - `welcome_signup`
   - `inactive_j2`
   - `browse_promo`
7. Wait for template **APPROVED** status before enabling Cloud in production.

---

## 3. Webhook

1. Deploy Edge Function `whatsapp-cloud-webhook`.
2. In Meta WhatsApp → Configuration → Webhook:
   - Callback URL: `https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-cloud-webhook`
   - Verify token: choose a long random string → `WHATSAPP_CLOUD_VERIFY_TOKEN`
3. Subscribe to `messages` (statuses).
4. Optional: set `WHATSAPP_CLOUD_APP_SECRET` for signature verification (enhance later).

---

## 4. Supabase Edge secrets (staging then production)

Dashboard → Project → Edge Functions → Secrets (never `VITE_*` / never Vercel frontend):

```
WHATSAPP_CLOUD_ENABLED=false
WHATSAPP_CLOUD_TOKEN=
WHATSAPP_CLOUD_PHONE_NUMBER_ID=
WHATSAPP_CLOUD_BUSINESS_ACCOUNT_ID=
WHATSAPP_CLOUD_VERIFY_TOKEN=
WHATSAPP_CLOUD_APP_SECRET=
```

Also keep `platform_settings.outreach_config.whatsapp_cloud_enabled` = `false` until go-live.

### Go-live sequence

1. Staging: set secrets + `WHATSAPP_CLOUD_ENABLED=true`
2. Set `outreach_config.whatsapp_cloud_enabled` true in staging SQL / admin
3. Opt-in a test profile: `profiles.whatsapp_opt_in = true` + valid `phone_e164`
4. Call `dispatch-outreach` with `channel: "whatsapp_cloud"` and slug `welcome_signup`
5. Confirm row in `outreach_send_log` + delivery on phone
6. Repeat on production

---

## 5. Opt-in rules (Zandofy)

- **Marketing** templates (`category = marketing`) require `profiles.whatsapp_opt_in = true`
- **Utility** templates may send without marketing opt-in (still need a valid number + approved Meta template)
- Collect opt-in in account settings / signup (frontend follow-up)

---

## 6. Automations (email / push first)

- Cron: `process-automation-workflows` respects `outreach_config.default_send_window` (default 18–19 `Africa/Kinshasa`) unless `ignore_send_window`
- Link a workflow to a template via `automation_workflows.template_id` (nullable — legacy columns still work)
- Activate only 1–2 workflows in staging first (`is_active = true`)

---

## 7. Smoke checklist

- [ ] Migration `170000` applied staging + prod  
- [ ] `/admin/notifications` → Messages utilitaires lists seeds  
- [ ] `/admin/users` → WA opens dialog when phone present  
- [ ] `dispatch-outreach` email/push works for one user  
- [ ] Cloud stays disabled until Meta number ready  
- [ ] After Meta: one Cloud test + `outreach_send_log` status  

---

## 8. Rollback / safety

- Flip `WHATSAPP_CLOUD_ENABLED=false` immediately if quality drops  
- Do not mass-enable all J0–J30 automations  
- Never put Cloud tokens in frontend env
