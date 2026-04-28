Je comprends la frustration. Les captures montrent que la configuration admin du transitaire est bien présente : mode Aérien, route CN → CD, couverture Kinshasa, profil tarifaire actif, palier KG rempli. Donc je ne vais pas repartir sur “il manque une couverture”. Le problème est très probablement dans le moteur de matching / calcul checkout.

Do I know what the issue is? Oui, il y a au moins deux failles concrètes dans le code actuel qui peuvent produire exactement ton symptôme alors que la config existe.

## Diagnostic retenu

### 1. Le palier KG peut être rejeté à tort avant l’arrondi
Dans le code actuel, le moteur cherche d’abord le palier avec le poids brut, puis seulement après il arrondit au kg.

Or ta capture montre un palier :

```text
0,1 kg → 1 kg : 17,9 USD/kg ou forfait
Arrondi activé
```

Si le panier donne un poids facturable faible, ou si l’arrondi transforme 0,8 kg en 1 kg, le moteur serveur actuel peut mal matcher :

- côté client : il choisit le palier avant l’arrondi ;
- côté SQL `quote_forwarder` : il utilise `max_kg` avec une borne stricte `< max_kg`, donc un poids arrondi à exactement `1 kg` peut ne plus entrer dans le palier `0,1 → 1`.

Résultat possible : profil trouvé, mais devis à `0`, puis le frontend filtre les offres `quote.total <= 0`, et l’UI affiche à tort “Aucun transitaire ne dessert Kinshasa”.

### 2. Le checkout affiche “aucun transitaire” même si le vrai problème est “profil trouvé mais devis calculé à 0”
Dans `fetchEligibleFreightOffers`, les offres sont supprimées si `quote.total <= 0`. Donc un bug de calcul tarifaire devient visuellement un faux message de couverture absente.

### 3. Les champs route Origine / Destination sont encore en saisie libre
Tu as raison : dans `Modifier un transitaire`, `Origine` et `Destination` sont encore des inputs texte ISO. Je vais les remplacer par des combobox pays basées sur les zones géographiques, comme les autres champs géographiques, pour éviter les valeurs incohérentes.

## Plan d’action immédiat

### A. Corriger le moteur tarifaire KG côté frontend
Modifier `frontend/src/services/freightQuote.ts` :

- calculer le poids utilisé pour choisir le palier après arrondi quand `round_up_to_kg = true` ;
- garantir qu’un palier `0,1 → 1` accepte bien un poids arrondi à `1 kg` ;
- éviter qu’un profil actif disparaisse juste parce que le calcul local donne temporairement `0` alors que le RPC serveur peut donner un montant.

### B. Corriger le RPC SQL `quote_forwarder`
Créer une nouvelle migration SQL qui remplace `public.quote_forwarder` :

- appliquer l’arrondi avant le choix final du palier KG ;
- rendre la borne `max_kg` inclusive pour les KG (`<= max_kg`) ;
- sécuriser les cas sous 0,1 kg pour que l’arrondi à 1 kg soit facturable ;
- éviter les `split_total = 0` injustifiés quand un palier actif existe.

### C. Rendre le matching checkout plus fiable
Modifier `frontend/src/services/freightQuoteCheckout.ts` :

- ne plus transformer silencieusement un calcul à 0 en “aucun transitaire ne dessert” ;
- utiliser le meilleur montant disponible entre `split_total`, `consolidated_total` et `quote.total` ;
- ajouter un diagnostic clair en console/admin :

```text
profil trouvé mais devis = 0
raison possible: aucun palier KG/CBM/pièce applicable
profile_id, forwarder_id, city_id checkout, city_id profil, mode, origine, destination
```

### D. Remplacer Origine / Destination par des combobox pays
Modifier `frontend/src/components/admin/forwarders/ForwarderFormDialog.tsx` :

- remplacer les deux inputs manuels `Origine` et `Destination` par des sélecteurs pays ;
- stocker toujours l’ISO2 officiel du pays sélectionné (`CN`, `CD`, etc.) ;
- conserver l’affichage compact `CN → CD` dans les badges existants.

### E. Fournir un fichier SQL téléchargeable
Générer un fichier dans `/mnt/documents/`, par exemple :

```text
zandofy_forwarder_checkout_hotfix_kg_routes_2026-04-29.sql
```

Il contiendra uniquement les changements DB nécessaires :

- remplacement sécurisé de `quote_forwarder` ;
- éventuel commentaire de fonction ;
- requêtes de vérification read-only à exécuter après migration pour confirmer :

```sql
-- Vérifier profils CN -> CD / Kinshasa / air
-- Vérifier paliers KG actifs
-- Tester quote_forwarder sur un profil VERY SPEED
```

### F. Vérification ciblée
Après application :

1. un profil VERY SPEED `air / CD / Kinshasa` avec palier `0,1 → 1` doit produire un total > 0 ;
2. le checkout ne doit plus afficher “aucun transitaire” si la route CN → CD et le profil Kinshasa existent ;
3. si un blocage reste, l’admin verra une raison exacte : ville UUID différente, mode absent, route absente, ou palier tarifaire réellement non applicable.

## Fichiers concernés

```text
frontend/src/services/freightQuote.ts
frontend/src/services/freightQuoteCheckout.ts
frontend/src/components/admin/forwarders/ForwarderFormDialog.tsx
supabase/migrations/<nouveau_hotfix>.sql
/mnt/documents/zandofy_forwarder_checkout_hotfix_kg_routes_2026-04-29.sql
```

## Ce que je ne vais pas refaire

- Je ne vais pas supposer que la couverture manque : tes captures prouvent qu’elle existe côté admin.
- Je ne vais pas assouplir la règle métier “destination = ville exacte” sans te le dire.
- Je ne vais pas remettre Chongqing ou une ville d’origine arbitraire : l’origine reste pays uniquement.

<lov-actions>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>