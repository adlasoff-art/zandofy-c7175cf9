

## Plan — 4 chantiers distincts

Ce plan couvre les 4 demandes identifiées. Vu l'ampleur, je propose de les implémenter en séquences. Voici le plan complet.

---

### 1. Tri des catégories par `sort_order` côté client

**Problème** : `CategoryBanner.tsx` et `MegaMenu.tsx` trient par `name_fr` au lieu de `sort_order`. Le header mobile le fait déjà correctement.

**Fichiers modifiés** :
- `frontend/src/components/CategoryBanner.tsx` — Remplacer `.order("name_fr")` par `.order("sort_order").order("name_fr")` et ajouter `sort_order` au `select`
- `frontend/src/components/MegaMenu.tsx` — Idem : `.order("sort_order").order("name_fr")` et ajouter `sort_order` au select

Aucune migration nécessaire (la colonne `sort_order` existe déjà sur `categories`).

---

### 2. Top bar (barre d'annonces) — CMS gérable

**Problème** : Les messages du top bar sont codés en dur via des clés i18n. L'admin ne peut pas les modifier, les masquer, ni changer les couleurs.

**Migration SQL** : Ajouter une entrée `platform_settings` avec clé `topbar_config` contenant :
```json
{
  "enabled": true,
  "mode": "static",       // "static" | "slide" | "marquee"
  "bg_color": "#1a1a1a",
  "text_color": "#ffffff",
  "messages": [
    { "text_fr": "Livraison gratuite...", "text_en": "Free shipping...", "visible": true },
    { "text_fr": "Retour gratuit...", "text_en": "Free returns...", "visible": true },
    { "text_fr": "Aucun frais caché...", "text_en": "No hidden fees...", "visible": true }
  ]
}
```

**Fichiers** :
- `frontend/src/components/Header.tsx` — Charger `topbar_config` depuis `platform_settings`, respecter `enabled`, `bg_color`, `text_color`, `mode` (marquee/slide), afficher les messages dynamiques
- `frontend/src/components/admin/cms/TopBarEditor.tsx` (nouveau) — Éditeur CMS : toggle on/off, choix mode (statique/slide/marquee), color pickers, liste de messages éditable (FR/EN), visibilité par message
- `frontend/src/pages/admin/AdminCMSPage.tsx` — Ajouter onglet "Top Bar" dans le CMS

---

### 3. Header & Footer — Customisation couleurs CMS

**Migration SQL** : Entrées `platform_settings` :
- `header_theme` : `{ bg_color, text_color, icon_color, badge_bg_color, badge_text_color, nav_bg_color, nav_text_color, nav_highlight_color, scrollbar_color }`
- `footer_theme` : `{ bg_color, text_color, link_color, guarantee_icon_color, guarantee_icon_style ("outline"|"filled"), guarantee_bg_color, newsletter_btn_bg, newsletter_btn_text, newsletter_input_bg, social_icon_color, social_border_color, section_title_color }`

**Fichiers** :
- `frontend/src/components/admin/cms/HeaderThemeEditor.tsx` (nouveau) — Color pickers pour chaque zone du header
- `frontend/src/components/admin/cms/FooterThemeEditor.tsx` (nouveau) — Color pickers pour chaque zone du footer
- `frontend/src/pages/admin/AdminCMSPage.tsx` — Ajouter onglets "Header" et "Footer Theme"
- `frontend/src/hooks/use-header-theme.ts` (nouveau) — Hook chargeant `header_theme` depuis `platform_settings`
- `frontend/src/hooks/use-footer-theme.ts` (nouveau) — Hook chargeant `footer_theme`
- `frontend/src/components/Header.tsx` — Appliquer les styles inline depuis le hook
- `frontend/src/components/Footer.tsx` — Appliquer les styles inline depuis le hook

---

### 4. Admin Users — Utilisateurs en ligne, filtres avancés, histogramme

**Migration SQL** : Ajouter colonnes à `profiles` :
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;
```

Créer des fonctions RPC similaires à celles des stores :
- `update_user_presence(p_user_id uuid)` — Met `is_online = true, last_seen_at = now()`
- `set_user_offline(p_user_id uuid)` — Met `is_online = false`

**Fichiers** :
- `frontend/src/hooks/use-user-presence.ts` (nouveau) — Heartbeat toutes les 60s (comme `useStorePresence`), appelé dans le layout principal
- `frontend/src/pages/admin/AdminUsersPage.tsx` :
  - Ajouter widget "En ligne" (compteur des `is_online = true` avec seuil `last_seen_at > now() - 2min`)
  - Voyant vert/gris dans le tableau à côté de chaque utilisateur
  - Filtres supplémentaires : en ligne/hors ligne, genre (homme/femme), tranche d'âge (18-25, 26-35, 36-45, 46+)
  - Histogramme des inscriptions (jour/semaine/mois/année) utilisant Recharts (déjà dans le projet)

---

### Résumé des fichiers

| Action | Fichier |
|---|---|
| Modifier | `CategoryBanner.tsx`, `MegaMenu.tsx` |
| Modifier | `Header.tsx`, `Footer.tsx` |
| Modifier | `AdminCMSPage.tsx`, `AdminUsersPage.tsx` |
| Créer | `TopBarEditor.tsx`, `HeaderThemeEditor.tsx`, `FooterThemeEditor.tsx` |
| Créer | `use-header-theme.ts`, `use-footer-theme.ts`, `use-user-presence.ts` |
| Migration | Colonnes `profiles.last_seen_at`, `profiles.is_online` + fonctions RPC presence |
| Insert data | Seed `platform_settings` pour `topbar_config`, `header_theme`, `footer_theme` |

### Ordre d'implémentation

1. Catégories sort_order (rapide, 2 fichiers)
2. Top bar CMS + migration
3. Header/Footer theme CMS
4. Admin users online + filtres + histogramme

