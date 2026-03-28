

## Plan : Sécurisation du code de confirmation (rate limiting + vérification server-side)

### Problème identifié

Actuellement, le `confirmation_code` est envoyé au frontend dans les requêtes Supabase (`select ... confirmation_code ...`) et la comparaison se fait côté client (JavaScript). Un utilisateur malveillant peut simplement ouvrir les DevTools pour voir le code sans aucun brute-force.

**3 points de vérification vulnérables :**
1. `TrackingPage.tsx` — compare `order.confirmation_code` déjà en mémoire
2. `DashboardPage.tsx` — fetch le code depuis la DB puis compare côté client  
3. `VendorOrderManager > HubPickupModal` — compare avec le code passé en prop

---

### Solution : Edge Function sécurisée avec rate limiting

#### 1. Créer une Edge Function `verify-confirmation-code`

- Accepte `{ order_id, code }` en POST
- Vérifie l'authentification (JWT)
- **Rate limiting en mémoire** : max 5 tentatives par order_id par fenêtre de 15 minutes
- Compare le code **server-side** (jamais renvoyé au client)
- Si valide : met à jour le statut de la commande → `delivered`
- Si invalide : retourne une erreur générique (pas d'indice sur le code attendu)
- Après 5 échecs : bloque temporairement avec message "Trop de tentatives"

#### 2. Retirer `confirmation_code` des SELECT côté client

- **TrackingPage.tsx** : retirer `confirmation_code` du select, garder uniquement un booléen `has_confirmation_code` (via une colonne calculée ou un simple `confirmation_code IS NOT NULL`)
- **DashboardPage.tsx** : idem, ne plus fetch le code ; appeler l'Edge Function pour vérifier
- **Note** : Le code reste visible pour le **propriétaire de la commande** (le client qui doit le donner au vendeur/livreur) — c'est le comportement voulu. On retire seulement la vérification côté client.

#### 3. Conserver l'affichage du code pour le client propriétaire

Le client doit toujours **voir** son propre code de confirmation dans son dashboard pour le communiquer au vendeur/livreur. Cette donnée est protégée par RLS (`user_id = auth.uid()`).

La sécurisation concerne uniquement la **vérification** : le vendeur/livreur qui saisit le code ne doit plus pouvoir le deviner par brute-force.

#### 4. Mettre à jour les composants frontend

- `DashboardPage.tsx` : remplacer `handleVerify` par un appel à `supabase.functions.invoke('verify-confirmation-code', ...)`
- `TrackingPage.tsx > ConfirmationCodeEntry` : idem
- `VendorOrderManager > HubPickupModal` : idem (le vendeur saisit le code donné par le client)

---

### Détails techniques

**Edge Function** (`supabase/functions/verify-confirmation-code/index.ts`) :
- Rate limit store : `Map<string, { attempts: number, resetAt: number }>`
- Clé de rate limit : `${order_id}:${user_ip}` 
- Seuil : 5 tentatives / 15 min
- Vérification : `SELECT confirmation_code FROM orders WHERE id = $1` côté serveur
- Réponse : `{ success: true }` ou `{ error: "Code incorrect" }` ou `{ error: "Trop de tentatives", retry_after: seconds }`

**Fichiers modifiés :**
- `supabase/functions/verify-confirmation-code/index.ts` (nouveau)
- `frontend/src/pages/TrackingPage.tsx` (appel Edge Function)
- `frontend/src/pages/DashboardPage.tsx` (appel Edge Function)
- `frontend/src/components/vendor/OrderTransitionModals.tsx` (appel Edge Function dans HubPickupModal)

