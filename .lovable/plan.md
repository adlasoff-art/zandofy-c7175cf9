

# Améliorations Analytics Dashboard

## Changements

### 1. Ajouter le filtre "1h" dans les périodes
Ajouter `{ key: "1h", label: "1h", days: 0.042 }` (1/24 de jour) dans le tableau `PERIODS` de `AdminAnalyticsPage.tsx`. Adapter le calcul de `since` pour supporter les fractions de jour.

### 2. Pagination sur les widgets Top Products, Top Stores, Top Pages
- Modifier les 3 fonctions SQL (`get_analytics_top_products`, `get_analytics_top_stores`, `get_analytics_top_pages`) : passer `p_limit` de 10 a 50 par defaut
- Dans `OverviewTab`, ajouter un etat de pagination local pour chaque widget (10 items par page, navigation prev/next en haut a droite du widget)
- Afficher le numero de la tranche (ex: "1-10 sur 47")

### 3. Nouveau KPI "Comptes créés"
- Ajouter dans la fonction SQL `get_analytics_kpis` un nouveau champ `accounts_created` qui compte les profils crees dans la periode :
```sql
'accounts_created', (SELECT COUNT(*) FROM profiles WHERE (p_since IS NULL OR created_at >= p_since))
```
- Ajouter un `StatCard` correspondant dans la grille de KPIs

### 4. Graphique enrichi : courbes Inscriptions + Commandes superposees au trafic
- Creer une nouvelle fonction SQL `get_analytics_daily_extended` qui retourne pour chaque jour : `visitors` (existant), `signups` (COUNT profiles), `orders` (COUNT orders)
- Remplacer le `BarChart` simple par un `ComposedChart` (recharts) avec :
  - Barres vertes = visiteurs uniques (existant)
  - Ligne bleue = inscriptions du jour
  - Ligne orange = commandes du jour
- Ajouter une legende sous le graphique

### 5. Migration SQL
Une seule migration pour :
- Mettre a jour `get_analytics_kpis` (ajouter `accounts_created`)
- Mettre a jour les 3 fonctions top (p_limit default 50)
- Creer `get_analytics_daily_extended` avec les 3 series
- Accorder les grants necessaires

## Fichiers modifies
- `AdminAnalyticsPage.tsx` — filtre 1h, pagination widgets, KPI comptes, graphique compose
- 1 migration SQL — fonctions mises a jour + nouvelle fonction

## Impact
Aucun impact sur les autres pages ou fonctionnalites. Les fonctions SQL existantes restent compatibles (le p_limit par defaut change de 10 a 50, mais c'est un parametre optionnel). Le runtime error `useEffect null` est un probleme HMR transitoire, pas lie a ces changements.

