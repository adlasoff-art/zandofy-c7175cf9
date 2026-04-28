
# Plan : correction tarification, activation transitaires, et UX maritime

## Contexte

Trois problèmes à corriger :
1. **Tarification incorrecte** : 0,54 kg facturé 35,80 USD au lieu de 17,90 USD (le moteur double ou applique mal le forfait).
2. **Transitaires invisibles** : 7 transitaires sur 8 bloqués en `pending` malgré leur création par l'admin.
3. **Maritime mal géré** : visible sans contrôle clair du seuil minimum.

## Règle de tarification (validée)

**Cas A — Poids agrégé < 1 kg**
→ Forfait fixe = prix du palier 1 kg (ex: 17,90 USD)
- 250 g, 750 g, 999 g → tous facturés 17,90 USD

**Cas B — Poids agrégé ≥ 1 kg**
→ Facturé : `(poids_réel + 0,1) × prix_par_kg`
- 1,2 kg → 1,3 × 17,90 = **23,27 USD**
- 1,5 kg → 1,6 × 17,90 = **28,64 USD**
- 2,0 kg → 2,1 × 17,90 = **37,59 USD**

Le buffer de 100 g est une **marge de sécurité interne** (variations balance, emballage). Le client ne voit que le total final, jamais le buffer.

**Agrégation** : le poids est sommé sur tous les articles du même groupe (même origine + même mode + même transitaire) AVANT d'appliquer la règle. Quatre articles de 250 g = 1,0 kg total → Cas B → (1,0 + 0,1) × 17,90 = 19,69 USD.

## Changements

### 1. Moteur de tarification

**Fichiers** : `frontend/src/services/freightQuote.ts`, `frontend/src/services/freightQuoteCheckout.ts`

- Remplacer la logique actuelle (qui itère par article et arrondit chaque sous-paquet) par une agrégation en deux passes :
  1. Sommer `total_kg` et `total_cbm` de tous les articles du groupe.
  2. Appliquer la règle Cas A / Cas B une seule fois sur le total.
- Supprimer tout `Math.ceil` au niveau de l'article individuel.
- Le prix unitaire `prix_par_kg` est lu depuis le palier 1 kg du transitaire (premier tier `kg_tiers`).
- Pour les paliers > 1 kg configurés (ex: 5–10 kg avec un prix dégressif), appliquer le tier correspondant au poids réel + 0,1, pas au poids arrondi.

### 2. Activation des transitaires (les deux à la fois)

**Migration SQL** :
- Trigger `BEFORE INSERT` sur `forwarders` : si l'utilisateur créateur est admin (`has_role(auth.uid(), 'admin')`), forcer `status = 'approved'` et `is_active = true`.
- Migration ponctuelle : `UPDATE forwarders SET status = 'approved', is_active = true WHERE status = 'pending' AND is_platform_owned = true` pour débloquer les 7 transitaires actuels.

**Fichiers UI** :
- `frontend/src/components/admin/forwarders/ForwardersList.tsx` : ajouter un bouton vert "Approuver et activer" visible uniquement quand `status = 'pending'`. Un clic → mutation Supabase qui passe `status='approved'` + `is_active=true`.
- `frontend/src/components/admin/forwarders/ForwarderFormDialog.tsx` : à la création par admin, pré-remplir et envoyer `status='approved'` + `is_active=true` côté front (ceinture + bretelles avec le trigger).

### 3. Maritime sous seuil — onglet visible mais grisé

**Fichier** : `frontend/src/components/CheckoutShippingCalculator.tsx` (et `FreightSelector.tsx`)

- L'onglet "Maritime" reste **visible** dans la liste des modes mais est **disabled** (grisé, non cliquable) tant que `cart_subtotal < sea_mode_min_order` (ex: 49 USD).
- Tooltip / message sous l'onglet : "Ajoutez X USD pour débloquer le fret maritime".
- Les transitaires maritimes sont **masqués** de la liste des offres tant que le seuil n'est pas atteint, peu importe l'onglet sélectionné.
- Quand le seuil est atteint, l'onglet redevient cliquable et les offres apparaissent normalement.

### 4. Diagnostic admin enrichi

**Fichier** : `frontend/src/components/checkout/FreightSelector.tsx` (bloc DEBUG ADMIN existant)

Pour chaque transitaire en échec, afficher la raison exacte + action recommandée :
- `status = 'pending'` → "Statut en attente — [Approuver maintenant]" (lien vers admin)
- `is_active = false` → "Désactivé — réactiver dans l'admin"
- Pas de route `origin → destination` → "Ajouter route CN→CD dans coverage_routes"
- Mode non supporté → "Activer le mode 'sea' dans supported_modes"
- Ville non couverte → "Ajouter Kinshasa aux villes desservies"

### 5. Clarification UI des paliers KG

**Fichier** : `frontend/src/components/admin/forwarders/KgTiersEditor.tsx` (ou équivalent)

- Renommer clairement les colonnes : "Prix forfaitaire (palier 1 kg)" vs "Prix par kg additionnel".
- Ajouter une note explicative : "Le palier 1 kg sert de forfait minimum pour tout poids < 1 kg. Au-delà, le poids réel + 100 g de marge est multiplié par le prix/kg du palier correspondant."

## Détails techniques

**Pseudo-code moteur** :
```text
function quoteGroup(items, forwarder):
  total_kg = sum(item.weight_kg for item in items)
  total_cbm = sum(item.cbm for item in items)
  base_tier = forwarder.kg_tiers[0]  // palier 1 kg

  if total_kg < 1.0:
    return base_tier.price_per_kg  // forfait

  // Cas B : poids réel + buffer 100g
  billable_kg = total_kg + 0.1
  tier = findTierForWeight(forwarder.kg_tiers, billable_kg)
  return billable_kg * tier.price_per_kg
```

**Trigger SQL** :
```text
CREATE TRIGGER auto_approve_admin_forwarder
BEFORE INSERT ON public.forwarders
FOR EACH ROW EXECUTE FUNCTION auto_approve_if_admin();
```

## Fichiers modifiés

- `frontend/src/services/freightQuote.ts`
- `frontend/src/services/freightQuoteCheckout.ts`
- `frontend/src/components/CheckoutShippingCalculator.tsx`
- `frontend/src/components/checkout/FreightSelector.tsx`
- `frontend/src/components/admin/forwarders/ForwardersList.tsx`
- `frontend/src/components/admin/forwarders/ForwarderFormDialog.tsx`
- `frontend/src/components/admin/forwarders/KgTiersEditor.tsx`
- nouvelle migration SQL : trigger auto-approve + UPDATE des 7 pending

## Validation post-déploiement

1. Tester avec 0,54 kg → doit afficher **17,90 USD** exactement.
2. Tester avec 1,2 kg → doit afficher **23,27 USD**.
3. Tester avec 4 articles de 250 g → doit afficher **19,69 USD**.
4. Vérifier que les 7 transitaires apparaissent dans le checkout.
5. Créer un nouveau transitaire admin → doit être actif immédiatement.
6. Panier < 49 USD → onglet Maritime grisé avec message.
7. Panier ≥ 49 USD → onglet Maritime cliquable, transitaires maritimes visibles.

Approuve ce plan pour que je passe en mode build et applique les corrections.
