# Checkout smoke checklist (5 scénarios)

Run on **staging** after migrations `150000–161000` + frontend deploy.

| # | Scénario | Attendu |
|---|----------|---------|
| 1 | Mono-store **last_mile** (same city) + home delivery | 1 order, `fulfillment_lane=last_mile`, operator optional, last_mile fee or Enterprise credit |
| 2 | Mono-store **freight** (cross-border) | 1 order freight, forwarder quote, **no** last-mile UI required |
| 3 | Panier **mixte** local + intl | ≥2 orders (`-A/-B`), récap N envois, freight full price (not ratio-diluted) |
| 4 | Multi-store group checkout | compat RPC OK, session multi-order |
| 5 | Last-mile `pay_with_shipping` | `orders.total` includes last_mile fee (unless credit/sub) |

Extra :

- [ ] Empty carrier allowlist → same operators/forwarders as coverage
- [ ] Buyer cannot UPDATE `last_mile_fee` / `included_delivery_credit` via PostgREST
- [ ] `preview_included_delivery_credit` shows 0 fee when Enterprise remaining > 0 and weight ≤ 10 kg
