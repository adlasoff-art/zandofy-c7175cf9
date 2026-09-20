# Discovery Flutter mirror notes

After web smoke (Hommes + local + city_id):

1. Depend on `mobile/zandofy_discovery` from the Flutter app `pubspec.yaml` (path).
2. Persist via Supabase RPC `set_own_discovery_prefs`.
3. Mirror sheet steps from web `DiscoveryOnboardingSheet`.
4. Hide-if-empty I9 flags: `samples_enabled`, `rfq_enabled`, wallet, buyer_protection — see `docs/I9_MARKETPLACE_MOBILE_SYNC.md`.
