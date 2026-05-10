---
name: PWA Versioning Protocol (Option B)
description: Source unique frontend/src/version.ts. Lovable doit demander avant chaque bump. patch=silencieux, minor/major=modale+push notify-app-update
type: preference
---

# Protocole Versionning PWA — Option B

**Source unique** : `frontend/src/version.ts` (`APP_VERSION` + `SHOW_UPDATE_PROMPT`).
Le SW est enregistré via `/sw.js?v=${APP_VERSION}` dans `frontend/src/main.tsx`.

## Règle obligatoire

À la fin de chaque itération significative (lot terminé, feature majeure, refactor notable),
**je DOIS demander à l'utilisateur** :
> "Veux-tu bumper la version (patch / minor / major) pour notifier les 600+ utilisateurs PWA installés ?"

Aucun bump silencieux. Aucun bump sans demander.

## SemVer simplifié

| Bump | Cas d'usage | `APP_VERSION` | `SHOW_UPDATE_PROMPT` | Push broadcast |
|------|-------------|---------------|----------------------|----------------|
| patch | correctif texte / micro-fix UI | 1.9.0 → 1.9.1 | `false` | non (SW silencieux) |
| minor | fin de lot / nouvelle feature | 1.9.1 → 1.10.0 | `true` | oui via `notify-app-update` |
| major | refonte UX / breaking | 1.x → 2.0.0 | `true` | oui |

## Quand `SHOW_UPDATE_PROMPT = true`

1. Bump `APP_VERSION` dans `frontend/src/version.ts`.
2. Mettre `SHOW_UPDATE_PROMPT = true`.
3. Après merge en prod, appeler l'edge function `notify-app-update` (admin only) :
   `{ version: "1.10.0" }` → broadcast push à toutes les `push_subscriptions` actives.
4. Au bump patch suivant, remettre `SHOW_UPDATE_PROMPT = false`.

## Pourquoi

- 600+ utilisateurs PWA installés ; spammer une modale à chaque itération = mauvaise UX.
- Patches techniques doivent passer en silence (NetworkFirst sur HTML + nouveau SW activé seul).
- Seuls les vrais jalons utilisateurs (lot terminé) déclenchent la modale + push.

## Référence

`SAFETY_POLICY.md` §"Versionning PWA" et `docs/SAFETY_POLICY.md` §6.