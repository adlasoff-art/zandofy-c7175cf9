# zandofy_discovery

Dart mirror of Zandofy web Discovery prefs + feed assembler contracts.
Use from the Flutter client app (not a full marketplace app).

## Contracts

| Web | Dart |
|-----|------|
| `frontend/src/lib/discovery-prefs.ts` | `lib/src/discovery_prefs.dart` |
| `frontend/src/lib/discovery-engine.ts` | `lib/src/discovery_engine.dart` |
| RPC `set_own_discovery_prefs` | `DiscoveryPrefsRepository.persist` |
| CMS `discovery_mix` | `DiscoveryMixConfig` |

See also `docs/DISCOVERY_MOBILE_HANDOFF.md` and `_flutter_specs/`.

## Tests

```bash
dart test
```
