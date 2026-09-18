# Mobile chrome contract (PWA → Flutter)

Bottom navigation (exactly 5, Jacob / Alibaba pattern):

1. Accueil → `/` (re-tap on Accueil reshuffles Tendance feed)
2. Catégories → toggles the same in-header categories panel (event `toggle-mobile-categories`)
3. Messagerie → `/messages` (guest → `/auth?redirect=%2Fmessages`)
4. Panier → cart drawer
5. Compte → `/account` (guest → `/auth?redirect=%2Faccount`)

Header (sticky):

- Logo + always-visible PredictiveSearch (scroll with header)
- Favoris (Heart) in header actions
- Messagerie icon only from `md+` (phone uses bottom tab)
- No hamburger; categories panel opened from bottom tab only
- **Top bar CMS** (`platform_settings.topbar_config`): full-bleed promo under status bar (`safe-area-inset-top`). Fields: `enabled`, `mode` (static|slide|marquee), colors, `messages[]`, optional `link_url` (sanitized `/` or `https:` only), `dismissible` (session). Mobile: multi-message static auto-rotates as slide.

Homepage mobile content order:

1. Hero
2. **Market switch** Tout | Local | International (`shop_type` filter; `localStorage` key `zandofy_home_market`; discovery only — **not** checkout)
3. CategoryBanner (1 horizontal row) + HomeServiceCards
4. Super Promo (hidden if empty)
5. Pour vous / Populaires rails
6. Top tendances rail
7. CMS category/store rails (`cms_homepage_sections` keys `category_rail` | `store_rail`)
8. Tendance feed (session shuffle; POP from PDP preserves order + scroll)

Desktop (`lg+`) may show FeaturedSidebar beside Top tendances — not in the mobile stack.

### Local / International (Flutter parity)

| Item | Contract |
|------|----------|
| Values | `all` \| `local` \| `international` |
| Persistence | `localStorage` / `SharedPreferences` → `zandofy_home_market` |
| API | `fetchProducts({ shopType })` → `products_public.shop_type` |
| Scope | Accueil rails + feed only; cart/checkout unchanged |
| Semantic | Store market type (stock local vs import), **not** buyer city |

Do not put Search or Settings in the bottom bar.

### Pixel parity notes (Flutter)

- Touch targets ≥ 44px bottom nav + top-bar dismiss.
- Header + top bar share sticky stack; top bar paints into status bar.
- Same section order and event names as above — native UI can diverge visually but IA must match.
- Body padding includes `safe-area-inset-bottom` under the bottom nav.
