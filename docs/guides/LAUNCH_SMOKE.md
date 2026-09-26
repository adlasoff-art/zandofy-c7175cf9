# Launch smoke — readiness pubs

Exécuter après [LAUNCH_OPS_CHECKLIST.md](./LAUNCH_OPS_CHECKLIST.md) (staging puis smoke court prod).

## Cases

| # | Parcours | Attendu | OK |
|---|----------|---------|----|
| 1 | Signup téléphone + mdp | Session immédiate → `/account` ; bannière « Ajoutez un email » ; **aucun SMS** | [ ] |
| 2 | Signup email + mdp | Session ; checkout **non** bloqué sur email (gate OFF) | [ ] |
| 3 | Login téléphone | OK via Edge `resolve-auth-identifier` | [ ] |
| 4 | Guest panier → auth → checkout mono MoMo | 1 order pending → paid | [ ] |
| 5 | 2 boutiques + MoMo (si SQL `24180000`) | 1 charge / 2 orders / session paid | [ ] |
| 6 | Become vendor sans KYC | Submit bloqué ; message parcours KYC | [ ] |
| 7 | Forgot password avec téléphone seul | Message « email requis » | [ ] |
| 8 | Accueil 1ʳᵉ visite | Discovery sheet ≥ ~8s ; annonce CMS ≥ 30s après Discovery | [ ] |

## Réglages à confirmer

- Confirm email **OFF**
- `auth_settings.mode` = `fluid`
- `gate_checkout_on_email_confirm` = `false`
- `discovery_popup_delay_sec` ≥ 30

## Dettes reportées (après pic — I5)

Ne pas traiter pendant le lancement :

- OTP SMS réel (auth téléphone)
- Fusion Discovery sheet + page `/onboarding`
- Cap serveur photos dans `sync_product_gallery` (aujourd’hui plafond UI 5)
- Last-mile dans `orders.total`
- Mode auth `strict` / hard-gate checkout email

## Notes

Deux onboardings coexistent volontairement demain :

1. **Discovery** (soft, Accueil) — goûts catalogue  
2. **`/onboarding`** — adresse / KYC dédiés  

Ne pas les fusionner avant stabilisation trafic.
