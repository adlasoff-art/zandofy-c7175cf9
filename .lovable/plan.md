

# Sélecteur de police global pour la plateforme

## Résumé

Ajouter dans l'onglet **Branding & Logo** (CMS) un sélecteur de police globale. L'admin peut changer la typographie de tout le site parmi 6 polices, avec preview en temps réel. Persistance via `platform_settings` (pas de migration SQL).

## 6 polices proposées

1. **Inter** (défaut actuel) — Sans-serif moderne, lisibilité optimale
2. **Outfit** — Police du logo Zandofy, toutes graisses 100-900
3. **Poppins** — Géométrique moderne, populaire e-commerce
4. **DM Sans** — Clean et contemporain
5. **Plus Jakarta Sans** — Élégant et professionnel
6. **Roboto** — Classique Google, universel, toutes graisses 100-900

## Modifications

### 1. `frontend/src/index.css`
- Étendre l'import Google Fonts pour les 6 familles (toutes graisses)
- Ajouter `--font-primary: 'Inter', sans-serif` dans `:root`
- `body` et `h1-h4` utilisent `var(--font-primary)`

### 2. `tailwind.config.ts` + `frontend/tailwind.config.ts`
- `fontFamily.sans` → `['var(--font-primary)', 'system-ui', 'sans-serif']`

### 3. `frontend/src/components/admin/cms/BrandingTab.tsx`
- Section "Typographie" avec Select des 6 polices (chaque option rendue dans sa propre police)
- Preview : H1, H2, paragraphe, bouton dans la police sélectionnée avec graisses variées
- Sauvegarde `primary_font` dans `platform_settings` (clé `branding`, champ JSONB existant)

### 4. `frontend/src/hooks/usePlatformFont.ts` (nouveau)
- Hook chargeant `branding.primary_font` et appliquant `--font-primary` sur `documentElement`
- Défaut : Inter

### 5. `frontend/src/App.tsx`
- Appel de `usePlatformFont()`

### 6. Nettoyage inline
- `AuthPage.tsx`, `OnboardingPage.tsx`, `ResetPassword.tsx` : remplacer `fontFamily: "'Inter'"` par `var(--font-primary)`

## Pas de migration SQL
Le champ `primary_font` est stocké dans le JSONB existant de `platform_settings`.

