# Clarification : comment fonctionne aujourd'hui la livraison + ce qu'il faut corriger

## Réponses claires à vos questions

### Q1 — La "legacy" (zones géographiques + frais commune/quartier) existe-t-elle encore ?

**Oui, elle existe toujours**, mais elle n'est **plus utilisée pour le calcul checkout** depuis Lot 11B. Concrètement :

- Tables `communes.delivery_fee` et `quartiers.delivery_surcharge` → toujours en base, toujours éditables côté admin (Zones géographiques).
- Code `frontend/src/lib/last-mile-fee.ts` (formule `commune.delivery_fee + quartier.delivery_surcharge`) → **n'est plus appelé par le checkout**. Il ne sert plus que de référence/legacy.
- Le checkout utilise désormais **uniquement** `useOperatorQuotes` → vue `v_active_operators_by_city` + table `delivery_operator_rates`.

**Conséquence** : si aucun opérateur n'a de tarif approuvé sur la commune/quartier du client, le checkout affiche **"Aucun livreur ne dessert encore votre quartier"** (ce que vous voyez sur votre capture). La legacy ne prend plus le relais en fallback.

### Q2 — L'admin doit-il se reconnecter en tant qu'opérateur pour saisir les tarifs commune/quartier ?

**Aujourd'hui : oui** — mais le système est incomplet. Voici la répartition actuelle des responsabilités :

| Acteur | Où | Quoi |
|---|---|---|
| **Admin** (`/admin/operator-rate-caps`) | Plafonds par **ville** uniquement | Définit `max_base_price`, `max_surcharge`, `max_estimated_minutes` par ville. C'est un **plafond** (garde-fou), pas un tarif. |
| **Admin** (création opérateur, étape 5) | Tarif initial par **ville couverte** | Saisit `base_price`, `surcharge`, `estimated_minutes` au niveau **ville** (pas commune ni quartier) |
| **Opérateur** (`/operator/rates`) | CRUD tarifs par **zone / commune / quartier** | Peut créer N tarifs par ville avec granularité commune et quartier → soumis à validation admin |
| **Admin** (`/admin/operator-rates-pending`) | Approbation | Approve/refuse les tarifs soumis par opérateurs (sauf opérateur plateforme = auto-approuvé) |

**Ce qui manque dans l'UI admin** : pas d'écran qui permette à l'admin de saisir directement, pour le compte d'un opérateur, les tarifs **commune par commune et quartier par quartier**. L'admin ne saisit que le tarif **initial niveau ville**. Pour la granularité commune/quartier, il faut soit :
- Se connecter en tant que propriétaire de l'opérateur sur `/operator/rates`, OU
- Insérer en base via SQL, OU
- Ajouter un écran admin "Gérer les tarifs de l'opérateur X" (recommandation).

### Q3 — Pourquoi "aucun utilisateur trouvé" dans la recherche propriétaire ?

J'ai vérifié la DB : la RLS `profiles` est correcte (admins lisent tout) et il y a 4 profils dont 3 ont un `first_name`. Donc **la RLS n'est pas en cause**.

Causes probables :
1. **Recherche par prénom/nom uniquement** (jamais email — c'est volontaire, PII-safe) → si vous tapez l'email, ça ne match rien.
2. **Minimum 2 caractères** + debounce 300ms.
3. La requête fait `OR(first_name.ilike.%term%, last_name.ilike.%term%)`. Si vous tapez "J Dupont", ça cherche literally "J Dupont" → 0 résultat.

**Test à faire** : tapez juste un prénom (ex: "Jean") ou juste un nom. Si toujours 0 résultat alors qu'un profil existe, c'est un bug à creuser.

### Q4 — Si la legacy reste opérationnelle, comment ça s'articule avec les opérateurs plateforme ?

Aujourd'hui : **la legacy n'est plus opérationnelle au checkout**. Il n'y a plus deux moteurs en parallèle. Très Speed Delivery (l'opérateur plateforme) doit avoir ses tarifs dans `delivery_operator_rates` comme n'importe quel autre opérateur — c'est exactement ce qu'on vient de seeder pour Kinshasa.

La seule différence opérateur plateforme vs tiers : pas de plafonds, validation auto, commission différente.

---

## Décisions à prendre (proposées)

Pour aller au bout du système multi-opérateurs proprement, voici ce que je propose. Validez/ajustez puis je passerai en build mode.

### Fix 1 — Recherche propriétaire opérateur
- **Ajouter la recherche par email** dans `OperatorOwnerSearch` (passer par une RPC `search_users_admin(term)` SECURITY DEFINER pour rester PII-safe côté liste publique mais débloquer admin).
- **Afficher un message plus clair** indiquant qu'on cherche par prénom OU nom OU email.

### Fix 2 — Tarifs commune/quartier saisissables par admin
- **Nouvelle page admin** `/admin/operators/:id/rates` permettant à l'admin de gérer les tarifs (zone/commune/quartier) **au nom d'un opérateur**, avec auto-approbation.
- Réutilise les composants existants de `OperatorRatesPage` mais en mode admin.

### Fix 3 — Décision sur la legacy commune/quartier
Trois options :
- **A) Supprimer la legacy** (`last-mile-fee.ts`, champs `delivery_fee`/`delivery_surcharge`) → propre, mono-moteur.
- **B) Fallback legacy** : si aucun opérateur ne couvre, afficher la legacy comme "Livraison Zandofy directe" (ressuscite l'ancien moteur en dernier recours). Risque : confusion clients.
- **C) Garder legacy comme outil de référence** pour l'admin (ex: pré-remplir les tarifs proposés aux opérateurs) sans l'utiliser au checkout.

### Fix 4 — Améliorer le message UX checkout
"Aucun livreur ne dessert encore votre quartier" → ajouter un CTA "Demander une livraison sur ma zone" qui notifie l'admin (signal de demande non-couverte).

---

## Détails techniques

- **Tables actives** : `delivery_operators`, `delivery_operator_cities`, `delivery_operator_rates` (status pending/approved/rejected), `delivery_operator_city_caps`, vue `v_active_operators_by_city`.
- **Tables legacy** : `communes.delivery_fee`, `quartiers.delivery_surcharge`, `quartiers.is_restricted` — toujours en base.
- **Hook checkout** : `frontend/src/hooks/useOperatorQuotes.ts` (filtre `status=approved` + `is_active=true`).
- **Edge functions** : `admin-create-operator`, `admin-approve-operator` (assigne rôle `operator`), `admin-reject-operator`, `admin-suspend-operator`, `notify-admin-operator-rate`.

---

**Questions pour vous** :
1. Pour Fix 3, **Option A, B ou C** ?
2. Voulez-vous Fix 1 + Fix 2 + Fix 4 dans ce sprint, ou seulement un sous-ensemble ?
3. Pour la recherche owner : OK pour ajouter recherche par email côté admin (PII-safe via RPC) ?
