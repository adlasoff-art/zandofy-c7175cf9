# Discovery — handoff mobile (Flutter / iOS / Android)

Spec miroir pour l’IA mobile après stabilisation web. Voir aussi `docs/DISCOVERY_ENGINE.md` et `docs/I9_MARKETPLACE_MOBILE_SYNC.md`.

## Contrats à réutiliser

| Contrat | Détail |
|---------|--------|
| Prefs JSON | `DiscoveryPrefs` dans `frontend/src/lib/discovery-prefs.ts` — colonnes `profiles.discovery_prefs` |
| Local storage keys | `zandofy_discovery_prefs`, `zandofy_discovery_onboarding_snoozed` |
| RPC | `set_own_discovery_prefs(p_prefs jsonb)` — auth only, soft-fill gender |
| CMS | `platform_settings.auth_settings.discovery_mix`, `discovery_onboarding_*`, `discovery_popup_delay_sec` |
| Analytics | `discovery_onboarding_*`, `discovery_feed_assembled` → `analytics_events` |

## Surfaces à mirror

1. Soft onboarding sheet (brand primary green, ~large)  
2. Feed assembler client (mêmes ratios CMS) sur home rails, search, category, related  
3. Dashboard « Modifier mes goûts »  
4. Guest cart merge (déjà web) — hors discovery mais même parcours guest  

## Algo (resume)

- 65% cœur (audience + intérêts + géo proxy `shop_type`/`origin_country`)  
- 25% exploration (intl / autres cats / autre audience)  
- 10% neutre (unisex / empty gender)  
- Scope ville : 45% + 20% partition seed (proxy jusqu’à `stores.city` / I7)  
- Rotation : `rotation_hours` (défaut 12)

## Multi-passerelles paiement (préparation)

Prefs déjà collectées :

- `country_code` (ISO-2)  
- `payment_prefs[]` : `mobile_money` | `card` | `off_platform` | `later`  

Future **PawaPay** / gateways par pays : mapper `country_code` + prefs → provider actif sans re-onboarding. Router CMS `payment_gateways` + Edge stubs `pawapay-*` (KelPay défaut CD). Live API après secrets staging.

## Design tokens

- Primary : CSS `--primary` (hue 120, vert brand) — voir `_flutter_specs/01_design_system_et_da.md`  
- Sheet : fond primary, texte primary-foreground / blanc  

## Ordre suggéré mobile

1. Lire prefs + RPC persist  
2. Sheet UI parity  
3. Assembler feed partagé (package Dart mirroir des tests Vitest)  
4. Brancher home + search  
5. Analytics events  

## Hors scope immédiat

App Flutter complète (checkout PawaPay mobile, messages natifs, apps vendeur) — hors miroir.  
Package Dart : `mobile/zandofy_discovery/` (prefs + assembler). Enrichir `_flutter_specs/` après smoke web Hommes/local + I7.
