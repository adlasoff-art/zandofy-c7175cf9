# Zandofy Flutter — Design System & Direction Artistique

> Source de vérité web : `frontend/src/index.css`, `frontend/tailwind.config.ts`, `frontend/src/components/ui/*`, `frontend/index.html`.
> L’app Flutter cliente doit reproduire le **mode clair** par défaut (PWA mobile). Le mode sombre existe sur le web et doit être supporté pour parité.

---

## 1. Identité & principes

- **Marque** : vert Zandofy (hue HSL **120°**), marketplace généraliste, ton professionnel et rassurant.
- **Cible mobile** : cartes produits compactes, bottom navigation, touch targets ≥ 44 px, safe areas iOS.
- **CMS dynamique** : couleurs primaires peuvent être injectées via `platform_settings` (`use-cms-theme.ts`). Pour V1 Flutter, implémenter les **valeurs par défaut** ci-dessous ; prévoir un hook futur pour overrides CMS.

---

## 2. Couleurs — tokens CSS → Flutter

Format source : **HSL** sans préfixe (`120 100% 25%` = `hsl(120, 100%, 25%)`).

### 2.1 Mode clair (`:root`) — **référence principale**

| Token CSS | HSL | HEX (approx.) | Usage Flutter |
|-----------|-----|---------------|---------------|
| `--background` | 120 15% 96% | `#F4F7F4` | `ColorScheme.surface` / fond écran |
| `--foreground` | 120 55% 18% | `#1A4428` | Texte principal |
| `--card` | 0 0% 100% | `#FFFFFF` | Cartes, sheets |
| `--card-foreground` | 120 55% 18% | `#1A4428` | Texte sur cartes |
| `--primary` | 120 100% 25% | `#008000` | Boutons primaires, liens, ring focus |
| `--primary-foreground` | 0 0% 100% | `#FFFFFF` | Texte sur primary |
| `--secondary` | 120 100% 93% | `#E6FFE6` | Chips, fonds secondaires |
| `--secondary-foreground` | 120 55% 18% | `#1A4428` | Texte sur secondary |
| `--muted` | 120 20% 95% | `#F2F5F2` | Zones désactivées / skeleton |
| `--muted-foreground` | 120 10% 45% | `#6B7A6B` | Texte secondaire, meta |
| `--accent` | 120 76% 55% | `#63E763` | Hover, accents interactifs |
| `--accent-foreground` | 120 55% 10% | `#0F2A14` | Texte sur accent |
| `--destructive` | 0 84% 60% | `#EF4444` | Erreurs, suppression |
| `--destructive-foreground` | 0 0% 100% | `#FFFFFF` | Texte sur destructive |
| `--border` | 120 20% 88% | `#D8E4D8` | Bordures |
| `--input` | 120 20% 88% | `#D8E4D8` | Champs formulaire |
| `--ring` | 120 100% 25% | `#008000` | Focus ring |
| `--sale` | 0 84% 55% | `#EF3B3B` | Prix promo, badge réduction, cœur favori actif |
| `--sale-foreground` | 0 0% 100% | `#FFFFFF` | Texte sur sale |
| `--badge-new` | 45 100% 50% | `#FFCC00` | Badge « Nouveau » |
| `--badge-new-foreground` | 45 80% 15% | `#4D3D00` | Texte badge nouveau |
| `--zandofy-certified` | 217 91% 60% | `#3B9EFE` | Badge certifié / vendeur vérifié |
| `--cert-vendor` | 217 91% 60% | `#3B9EFE` | Certification vendeur |
| `--cert-rider` | 152 69% 40% | `#22A66F` | Certification livreur |
| `--cert-client` | 210 60% 60% | `#5A9FD4` | Certification client |
| `--chat-received` | 120 20% 92% | `#E8EFE8` | Bulles messages reçus |

**PWA / barre système** (`index.html`) :
- `theme-color` clair : `#1A5C2E`
- `theme-color` sombre : `#0F1A12`

### 2.2 Gradients & ombres custom

```css
--brand-gradient: linear-gradient(135deg, hsl(120 100% 25%), hsl(120 76% 55%));
--brand-gradient-soft: linear-gradient(135deg, hsl(120 100% 93%), hsl(120 60% 96%));
--shadow-brand: 0 4px 20px -4px hsl(120 100% 25% / 0.15);
--shadow-card: 0 1px 4px 0 hsl(120 20% 20% / 0.08), 0 1px 3px -1px hsl(120 20% 20% / 0.06);
--shadow-card-hover: 0 8px 24px -4px hsl(120 20% 20% / 0.14), 0 6px 10px -4px hsl(120 20% 20% / 0.08);
```

Flutter :
- `LinearGradient` 135° : `#008000` → `#63E763`
- `BoxShadow` card : offset (0,1), blur 4, color `Color(0x141A3314)` + second shadow blur 3
- Hover / pressed : shadow-card-hover

### 2.3 Mode sombre (`.dark`) — extraits utiles

| Token | HSL | HEX approx. |
|-------|-----|-------------|
| `--background` | 120 20% 6% | `#0C120C` |
| `--foreground` | 120 10% 90% | `#E3E8E3` |
| `--primary` | 120 76% 55% | `#63E763` |
| `--primary-foreground` | 120 55% 10% | `#0F2A14` |
| `--card` | 120 20% 9% | `#121812` |
| `--destructive` | 0 62% 30% | `#7A1F1F` |

### 2.4 Couleurs **hors** palette client (ne pas utiliser dans l’app cliente)

Palettes **operator** (bleu/cyan) et **forwarder** (bleu profond) dans `index.css` — réservées dashboards logistique, **pas** l’app client.

### 2.5 Statuts commande (badges UI web)

Référence `frontend/src/lib/order-status.ts` :

| Statut | Couleur texte Tailwind | Fond badge |
|--------|------------------------|------------|
| awaiting_payment, pending | amber-500 | amber-100 / amber-700 |
| confirmed | blue-500 | blue-100 / blue-700 |
| preparing | yellow-600 | yellow-100 / yellow-700 |
| in_shipping | indigo-500 | indigo-100 / indigo-700 |
| shipped | purple-500 | purple-100 / purple-700 |
| delivered | emerald-500 / primary | primary/10 |
| cancelled, payment_failed | destructive | destructive/10 |

---

## 3. Typographie

### 3.1 Familles

| Usage | Famille web | Weights | Flutter |
|-------|-------------|---------|---------|
| UI globale | **Inter** | 400, 500, 600, 700 | `GoogleFonts.inter` |
| Logo « Zandofy » | **Outfit** | 400, 700 | `GoogleFonts.outfit` |
| Display (config Tailwind) | Playfair Display | — | **Non utilisé** dans `index.html` ; préférer Outfit pour le wordmark |

Chargement web : `fonts.googleapis.com` — Inter + Outfit, `display=swap`.

CSS : `--font-primary: 'Inter', system-ui, sans-serif` ; `h1–h4` utilisent aussi Inter (pas une serif distincte sur le client).

### 3.2 Échelle typographique (composants réels)

| Élément | Classes Tailwind | Taille | Weight | Line height |
|---------|------------------|--------|--------|-------------|
| Body | `body` | 16 px (défaut) | 400 | normal |
| Bouton default | `text-sm font-medium` | 14 px | 500 | — |
| CardTitle (dialogs) | `text-2xl font-semibold` | 24 px | 600 | `leading-none` |
| CardDescription | `text-sm text-muted-foreground` | 14 px | 400 | — |
| Product card titre | `text-xs line-clamp-2 leading-snug` | 12 px | 400 | snug (~1.375) |
| Product card prix | `text-sm font-bold` | 14 px | 700 | — |
| Prix barré | `text-[11px]` | 11 px | 400 | — |
| Badge promo | `text-xs font-bold` | 12 px | 700 | — |
| Badge rank | `text-[9px] font-bold` | 9 px | 700 | — |
| Bottom nav | `text-[10px]` ou `text-xs` | 10–12 px | 500 | — |

**Titres pages** (patterns courants) :
- Hero / H1 : `text-2xl` à `text-3xl font-bold` (24–30 px)
- Section H2 : `text-lg font-semibold` (18 px)
- Sous-section : `text-base font-medium` (16 px)

### 3.3 Prix & devises

Le web formate via `formatPrice(usdPrice)` dans `I18nContext` :
- Base stockée en **USD** côté produit/commande
- Conversion affichage selon devise choisie (USD, EUR, XAF, CDF, NGN, GBP, CNY)
- XAF/CDF/NGN/CNY : entiers + symbole (`FCFA`, `FC`, `₦`, `¥`)
- Autres : symbole + 2 décimales

Flutter : reproduire la même logique (taux depuis `platform_settings` / défauts dans `I18nContext`).

---

## 4. Rayons, bordures, élévations

### 4.1 Border radius

| Token | Valeur | Usage |
|-------|--------|-------|
| `--radius` | `0.5rem` = **8 px** | Base |
| `rounded-lg` | 8 px | Cards génériques (`ui/card`) |
| `rounded-md` | 6 px | Boutons, inputs |
| `rounded-sm` | 2 px | **Product cards**, badges promo, image top |
| `rounded-full` | 9999 px | Boutons icône wishlist/compare, avatars |
| `rounded-t-sm` | 2 px top only | Image produit dans card |

### 4.2 Bordures

- Cards produit : `border border-border/40` → 1 px, couleur border à 40 % opacité
- Cards UI : `border` pleine `--border`
- Inputs / outline buttons : `border border-input`

### 4.3 Ombres (élévation Flutter)

| Classe | Équivalent Material |
|--------|---------------------|
| `shadow-sm` | Card standard (`ui/card`) |
| `shadow-card` | Product card repos |
| `shadow-card-hover` | Product card pressed / hover |
| `shadow-brand` | CTA hero, boutons mis en avant |

---

## 5. Espacements & grille

### 5.1 Container

| Breakpoint | Padding horizontal |
|------------|-------------------|
| default | 16 px (`1rem`) |
| sm | 24 px |
| lg | 64 px |
| xl | 80 px |
| max width 2xl | 1400 px |

Flutter mobile : padding horizontal **16 px** standard ; 12 px sur cartes produit (`px-2`).

### 5.2 Composants clés

| Zone | Spacing |
|------|---------|
| Card header | `p-6` (24 px), `space-y-1.5` |
| Card content | `p-6 pt-0` |
| Product card contenu | `px-2 pt-1.5 pb-2` |
| Bouton default | `h-10 px-4 py-2` → hauteur 40 px, padding H 16 px |
| Bouton lg | `h-11 px-8` → 44 px hauteur |
| Bouton sm | `h-9 px-3` → 36 px |
| Icône wishlist sur card | `w-8 h-8` (32 px), position `top-1.5 right-1.5` |
| Touch target utilitaire | `min-h-[44px] min-w-[44px]` |
| Safe area bottom | `env(safe-area-inset-bottom)` + nav ~56 px (`3.5rem` body padding mobile) |

### 5.3 Grille produits

- Mobile : **2 colonnes** (`grid-cols-2`), gap typique 8–12 px
- Image : `aspect-square` (ratio 1:1)
- Skeleton shimmer pendant chargement image

---

## 6. Composants UI — spécifications

### 6.1 Bouton (`ui/button.tsx`)

| Variant | Background | Text | Hover |
|---------|------------|------|-------|
| `default` | primary | primary-foreground | primary/90 |
| `destructive` | destructive | white | destructive/90 |
| `outline` | background + border input | foreground | accent bg |
| `secondary` | secondary | secondary-foreground | secondary/80 |
| `ghost` | transparent | foreground | accent |
| `link` | — | primary, underline offset 4 |

Commun : `rounded-md`, `text-sm font-medium`, focus `ring-2 ring-ring ring-offset-2`, disabled `opacity-50`.

### 6.2 Card (`ui/card.tsx`)

- `rounded-lg border bg-card shadow-sm`
- Title : 24 px semibold
- Description : 14 px muted

### 6.3 Product Card (`ProductCard.tsx`)

Structure :
1. Container : `bg-card rounded-sm shadow-card hover:shadow-card-hover border border-border/40`
2. Image zone : `aspect-square rounded-t-sm bg-muted`
3. Badges : promo `-X%` top-left ; rank seller bottom-left
4. Actions overlay : Heart (favoris), GitCompare (comparer) — cercles 32 px, `bg-card/80`
5. Texte : titre FR/EN selon locale ; prix bold ; original barré 11 px
6. Étoiles rating si présent
7. Bouton panier rapide (icône +)

États :
- Image loading : `skeleton-shimmer` animation 1.5s
- Hover desktop : 2ᵉ image gallery si disponible
- Ajout panier succès : icône check ~1.2 s

### 6.4 Bottom navigation (`MobileBottomNav`)

5 onglets : Accueil, Recherche, Alertes, Favoris, Panier (+ Compte selon variante).
- Hauteur ~56 px + safe area
- Icônes Lucide équivalent Material
- Label `text-[10px]` ou `text-xs`
- Active : couleur primary

### 6.5 Champs formulaire (`ui/input.tsx` pattern)

- Hauteur alignée bouton (`h-10`)
- Border input, focus ring primary
- Labels : `text-sm font-medium`

### 6.6 Toast / Snackbar

Web : Sonner + shadcn toaster.
- Succès : fond clair, texte foreground
- Erreur : `variant: destructive` → fond destructive, texte blanc
- Warning : amber (publication sociale partielle, etc.)

### 6.7 Skeleton

```css
background: linear-gradient(90deg, hsl(120 20% 92%) 25%, hsl(120 20% 96%) 50%, hsl(120 20% 92%) 75%);
animation: shimmer 1.5s ease-in-out infinite;
```

### 6.8 Animations

| Nom | Durée | Usage |
|-----|-------|-------|
| `fade-in` | 0.5s | Entrée contenu |
| `page-fade-in` | 0.2s | Transition page mobile |
| `active-press` | 100ms | `scale(0.97)` + opacity 0.8 au tap |
| `accordion` | 0.2s | Expand/collapse |

Respecter `prefers-reduced-motion` (désactiver animations).

---

## 7. Icônes

Web : **Lucide React** (`lucide-react`), taille courante **16 px** (`size={16}`) dans boutons, **12–14 px** sur cards.

Flutter : pack équivalent (lucide_icons ou material + custom) — tailles 16 / 20 / 24 px.

---

## 8. Images produit

- Placeholder : `/placeholder.svg`
- URLs Supabase Storage : préférer `object/public` (pas transform quota)
- Product card : `resize=contain`, quality 75, widths [160, 240, 360]
- Ratio affichage : carré 1:1

---

## 9. Thème Flutter recommandé (extrait)

```dart
// Valeurs mode clair — alignées index.css :root
static const Color primaryGreen = Color(0xFF008000);
static const Color accentGreen = Color(0xFF63E763);
static const Color background = Color(0xFFF4F7F4);
static const Color foreground = Color(0xFF1A4428);
static const Color destructive = Color(0xFFEF4444);
static const Color saleRed = Color(0xFFEF3B3B);
static const Color certifiedBlue = Color(0xFF3B9EFE);
static const double radiusBase = 8.0;
static const double radiusSm = 2.0; // product cards
```

---

## 10. Fichiers source à surveiller lors des mises à jour web

| Fichier | Contenu |
|---------|---------|
| `frontend/src/index.css` | Tokens couleurs, ombres, animations |
| `frontend/tailwind.config.ts` | Extensions radius, fonts |
| `frontend/src/hooks/use-cms-theme.ts` | Overrides CMS dynamiques |
| `frontend/src/components/ui/button.tsx` | Variants boutons |
| `frontend/src/components/ProductCard.tsx` | Card produit mobile |
| `frontend/index.html` | Fonts, theme-color |
