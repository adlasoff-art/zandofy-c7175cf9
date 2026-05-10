/**
 * Application version — single source of truth for the PWA update flow.
 *
 * Bump rules (SemVer simplifié) — voir SAFETY_POLICY.md §"Versionning PWA":
 *   - patch (1.9.0 → 1.9.1) : correctif mineur, texte, micro-fix UI
 *       → SHOW_UPDATE_PROMPT = false (mise à jour silencieuse en arrière-plan)
 *   - minor (1.9.1 → 1.10.0) : nouveau lot, refactor notable, nouvelle feature
 *       → SHOW_UPDATE_PROMPT = true  (modale + push "mise à jour disponible")
 *   - major (1.x → 2.0.0) : refonte UX, breaking change
 *       → SHOW_UPDATE_PROMPT = true  (idem)
 *
 * IMPORTANT : Lovable doit demander confirmation à l'utilisateur avant chaque bump.
 */
export const APP_VERSION = "1.10.2";

/**
 * Si true : affiche la modale "Nouvelle version disponible" + envoi push.
 * Si false : le nouveau Service Worker s'installe et s'active silencieusement.
 * Mettre à true uniquement pour les bumps `minor` ou `major`.
 */
export const SHOW_UPDATE_PROMPT = false;