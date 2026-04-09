

# Plan : Améliorations Analytics, PWA, Filtres et Email Templates

## Contexte et explications demandées

**Durée moyenne** : Elle est calculée à partir des événements `session_end` qui enregistrent le temps passé entre le début et la fin de session d'un utilisateur. Si un utilisateur quitte l'onglet ou ferme le navigateur, un événement `session_end` est émis avec la durée en secondes. La moyenne est faite sur toutes ces durées.

**PWA installées = 0** : Le problème est identifié : dans `AdminAnalyticsPage.tsx` ligne 551, `persistentPwaCount` est codé en dur à `0`. Le compteur ne lit jamais la table `pwa_installs`. Cela sera corrigé.

**Google Site Verification** : C'est un code fourni par Google Search Console (search.google.com/search-console). Après avoir ajouté votre site, Google vous donne un code de vérification (ex: `google1234abcd.html` ou une balise meta). Collez le contenu de la balise meta dans ce champ pour prouver à Google que vous êtes propriétaire du site.

**Google Analytics / GTM ID** : C'est l'identifiant de suivi de Google Analytics (format `G-XXXXXXX`) ou Google Tag Manager (format `GTM-XXXXXXX`). Créez un compte sur analytics.google.com, créez une propriété pour zandofy.com, et copiez l'ID de mesure dans ce champ. Cela injectera automatiquement le script de tracking Google sur votre site.

---

## Modifications techniques

### 1. Ajouter filtres 24h et 48h (AdminAnalyticsPage.tsx)

Ajouter `{ key: "24h", label: "24h", days: 1 }` et `{ key: "48h", label: "48h", days: 2 }` au tableau `PERIODS`.

### 2. Ajouter KPI "Visiteurs" + Histogramme trafic journalier (AdminAnalyticsPage.tsx)

- Ajouter une carte KPI "Visiteurs uniques" basée sur les `session_id` distincts (déjà calculé comme `uniqueSessions`, mais le renommer en "Visiteurs" pour plus de clarté).
- Ajouter un histogramme (BarChart de recharts) montrant le nombre de sessions/visiteurs par jour sur la période sélectionnée.

### 3. Corriger le compteur PWA (AdminAnalyticsPage.tsx)

- Remplacer `persistentPwaCount={0}` par une requête réelle vers la table `pwa_installs` avec le filtre de période.
- Ajouter un `useQuery` qui compte les entrées dans `pwa_installs` filtrées par la période sélectionnée.

### 4. Afficher les noms des boutiques (AdminAnalyticsPage.tsx)

- Dans `OverviewTab`, charger les noms des boutiques via `supabase.from("stores").select("id, name")` pour les IDs présents dans `topStores`.
- Afficher le nom de la boutique au lieu de l'ID tronqué.

### 5. Email Templates : Police Outfit + Upload logo (AdminEmailTemplatesPage.tsx)

- Remplacer le champ "Police" par un sélecteur (Select) proposant :
  - `Arial, sans-serif` (actuel)
  - `'Outfit', sans-serif` (police Zandofy)
- Ajouter l'import Google Fonts pour Outfit dans l'aperçu email.
- Remplacer le champ "URL du logo" par un composant d'upload (réutiliser le même pattern que `SeoBrandingSection.tsx` avec le bucket `seo-assets`).

### Fichiers modifiés
- `frontend/src/pages/admin/AdminAnalyticsPage.tsx` — filtres 24h/48h, visiteurs, histogramme, PWA count, noms boutiques
- `frontend/src/pages/admin/AdminEmailTemplatesPage.tsx` — sélecteur police Outfit, upload logo

