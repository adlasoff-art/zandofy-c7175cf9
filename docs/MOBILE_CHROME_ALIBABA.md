# Mobile chrome contract (PWA → Flutter)

Bottom navigation (exactly 5, Jacob / Alibaba pattern):

1. Accueil → `/` (re-tap on Accueil reshuffles Tendance feed)
2. Catégories → toggles the same in-header categories panel (event `toggle-mobile-categories`)
3. Messagerie → `/messages` (guest → `/auth?redirect=%2Fmessages`)
4. Panier → cart drawer
5. Compte → `/account` (guest → `/auth?redirect=%2Faccount`)

Header (sticky):

- **Mobile (&lt; `lg`) — 2 rows:**
  1. Logo + icons (tracking always visible, Heart, notifs if user)
  2. PredictiveSearch full width (sticky with header)
- **Desktop (`lg+`):** single row logo | search | actions (messages `md+`, cart `md+`)
- Messagerie icon only from `md+` (phone uses bottom tab)
- No hamburger; categories panel from bottom tab only
- Top bar CMS under status bar (`safe-area-inset-top`); `link_url` sanitized

Homepage mobile content order:

1. Hero
2. Market switch Tout | Local | International
3. CategoryBanner + HomeServiceCards
4. Super Promo
5. Pour vous / Populaires rails (12 items → 6×6 desktop)
6. Top tendances
7. CMS rails (`display_mode`: `rail` | `grid_page`)
8. Tendance feed

Do not put Search or Settings in the bottom bar.
