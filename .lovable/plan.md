
# Audit complet & refonte du système Fret/Logistique Zandofy

## 1. Ce que j'ai compris (réponse à ta demande d'explication)

### Le constat brutal

Aujourd'hui, **5 systèmes de tarification fret coexistent sans se parler** :

| # | Système | Table(s) DB | Rôle aujourd'hui |
|---|---------|------------|------------------|
| 1 | **Profils Transitaires** (le nouveau, icône `$`) | `forwarder_pricing_profiles` + `forwarder_cbm_tiers` + `forwarder_piece_tiers` + `forwarder_restrictions` | Devis fret international par transitaire, par mode, par pays/ville |
| 2 | **Routes Shipping** (Calculateur dynamique) | `shipping_routes` + `shipping_zones` | Tarif fret par route (origine→destination) en `$/kg` ou `$/cbm` — utilisé par le moteur générique |
| 3 | **Local Shipping Rates** | `local_shipping_rates` | Tarifs par zone à Kinshasa (base + km) |
| 4 | **Delivery Zones** (dernier km) | `delivery_zones` | Quartiers/communes — frais de livraison finale |
| 5 | **Vendor Delivery Zones** | `vendor_delivery_zones` | Override par boutique pour leur propre flotte |

→ **Le simulateur ET le calculateur dynamique existent en double** parce qu'historiquement le moteur `shipping_routes` a été construit avant le moteur `forwarder_pricing_profiles`. Tu as raison de t'interroger.

### Tes problèmes confirmés en base de données

Je viens de vérifier ta DB de prod :

1. ❌ **La migration aérien n'a JAMAIS été appliquée** : `forwarder_pricing_profiles` n'a PAS les colonnes `service_class`, `volumetric_divisor`. `forwarder_cbm_tiers` n'a PAS `unit`. C'est pour ça que tu vois toujours "Paliers CBM" même en mode Aérien — le code SQL d'avant a été partiellement avalé puis un rollback silencieux. **À refaire proprement.**

2. ❌ **Villes RDC = 20 seulement** (Kinshasa, Lubumbashi, Goma, Bukavu, Kisangani, Matadi, etc.). Il en manque ~30+ (Mbanza-Ngungu, Inongo, Gemena, Isiro, Bumba, Lisala, Buta, Aru, Mahagi, Butembo, Walikale, Idiofa, Tshela, Moanda, Mwene-Ditu, Lodja, etc.).

3. ❌ **Aucune liaison `cities ↔ shipping_zones ↔ provinces`** côté RDC. Les villes ne sont pas rattachées à des provinces en base.

4. ❌ **Le sélecteur Ville du dialog Tarifs** lit juste `cities WHERE is_active=true ORDER BY name` — d'où les 19/20 villes qui sortent. Aucun lien avec une "zone d'origine".

5. ❌ **Pays code ISO en saisie libre** au lieu d'un select sur les pays actifs de la plateforme.

6. ❌ **Acompte %** affiché en création même pour transitaires sans dépôt (la plateforme paye tout — donc UI confusante).

7. ❌ **Surcharges en %** (catégories dangereuses/fragiles/électroniques) → tu veux du **fixe par défaut, % en option**.

8. ❌ **Délais de livraison globaux** dans Paramètres globaux entrent en conflit avec délais par profil transitaire et délais par boutique locale.

9. ❌ **Transitaires absents de Logistique** (pas de compteur, pas de lien vers compte transporteur).

---

## 2. Architecture cible — Système Fret unifié

```text
                     ┌────────────────────────────┐
                     │   ZONES GÉOGRAPHIQUES      │  (source unique de vérité)
                     │   Pays → Provinces →       │
                     │   Villes → Communes →      │
                     │   Quartiers                │
                     └────────────┬───────────────┘
                                  │
              ┌───────────────────┼────────────────────┐
              ▼                   ▼                    ▼
   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
   │ FRET INTL        │  │ FRET LOCAL       │  │ DERNIER KM       │
   │ (Transitaires)   │  │ (Hub→Hub RDC)    │  │ (Quartier)       │
   │                  │  │                  │  │                  │
   │ profil par       │  │ tarif par route  │  │ tarif par        │
   │ Mode×Pays×Ville  │  │ ville→ville      │  │ commune/quartier │
   │ ×Classe service  │  │                  │  │                  │
   │ + paliers kg/CBM │  │ remplace         │  │ existant OK,     │
   │ + tarifs pièces  │  │ shipping_routes  │  │ à brancher sur   │
   │ + restrictions   │  │ (dépréciation)   │  │ géo unifiée      │
   └──────────────────┘  └──────────────────┘  └──────────────────┘
              │                   │                    │
              └───────────────────┼────────────────────┘
                                  ▼
                  ┌──────────────────────────────┐
                  │  MOTEUR DEVIS UNIFIÉ          │
                  │  quote_shipping(adresse,      │
                  │    panier, mode_pref) →       │
                  │  liste de transitaires        │
                  │  éligibles + prix total       │
                  │  (intl + local + dernier km)  │
                  └──────────────────────────────┘
                                  │
                                  ▼
                       Checkout client : on
                       ne montre QUE les
                       transitaires qui
                       couvrent l'adresse
```

**Principe clé** : un transitaire **n'apparaît au client que si** :
- son profil couvre la **ville/pays** de l'adresse de livraison ET
- son **mode** est compatible avec la boutique (boutique Chine→aérien/maritime, boutique locale→routier) ET
- aucune **restriction** ne bloque les produits du panier (ex: lithium → certains aériens refusent)

---

## 3. Plan d'action en 4 lots

### LOT 1 — Migration DB (à exécuter via fichier `.sql` téléchargeable)

Je produis un seul fichier `PROD_MIGRATION_05_freight_unified_foundation.sql` **idempotent** qui :

**1.A — Aérien (refaire ce qui a planté)**
- Ajoute `service_class` (`standard|express|vip|economy`), `volumetric_divisor` (défaut 6000 air, 5000 express, 333 maritime) sur `forwarder_pricing_profiles`
- Ajoute `unit` (`cbm|kg`) sur `forwarder_cbm_tiers`
- Réécrit `quote_forwarder()` avec poids facturable = `max(poids_réel, vol_cm³ / divisor)`
- Recompile `v_forwarder_profiles_public`
- Tests `pg_constraint` (pas d'EXCEPTION fragile)

**1.B — Lien Géo unifié**
- Ajoute `province_id` sur `cities` (déjà commencé mais pas finalisé)
- Crée table `provinces` si manquante (CD : Kinshasa, Kongo-Central, Kwilu, Kwango, Mai-Ndombe, Équateur, Sud-Ubangi, Nord-Ubangi, Mongala, Tshuapa, Tshopo, Bas-Uélé, Haut-Uélé, Ituri, Nord-Kivu, Sud-Kivu, Maniema, Sankuru, Kasaï, Kasaï-Central, Kasaï-Oriental, Lomami, Haut-Lomami, Tanganyika, Haut-Katanga, Lualaba) — **26 provinces RDC**
- Insère **toutes les villes RDC manquantes** rattachées à leur province (~50 villes ajoutées)
- Rattache les villes existantes à leur province

**1.C — Surcharges en valeurs FIXES (priorité fixe, % optionnel)**
- Refactorise `forwarder_restrictions` en `forwarder_surcharges` :
  - `surcharge_type` (`fixed_per_kg | fixed_per_cbm | fixed_per_order | percent`)
  - `amount` (numérique)
  - `category_id` (lien catégorie : électronique, fragile, dangereux, etc.)
- Migration des restrictions actuelles vers le nouveau format en gardant les `forbidden|license_required|info`

**1.D — Lien Transitaire ↔ Logistique**
- Ajoute `linked_transporter_user_id` sur `forwarders`
- Ajoute rôle `forwarder` dans l'enum `app_role` (à côté de `transporter`, `rider`)

**1.E — Dépréciation `shipping_routes` (sans destruction)**
- Vue `v_shipping_routes_legacy` créée pour compat
- Drapeau `legacy_routes_enabled` dans `forwarders_config` (par défaut `true` pendant transition, `false` quand prêt)

### LOT 2 — Refonte UI Admin Transitaires

**`ForwarderPricingProfilesDialog.tsx`** :
- ✅ Sélecteur **Pays** = liste des **pays actifs de la plateforme** (plus de saisie libre)
- ✅ Sélecteur **Province** (apparaît après pays) = provinces du pays choisi
- ✅ Sélecteur **Ville** = villes de la province choisie (filtrées par `province_id`)
- ✅ Champ **Classe de service** (Standard / Express / VIP / Economy)
- ✅ Champ **Diviseur volumétrique** (visible si mode = Aérien, défaut 6000)
- ✅ Champ **Acompte %** masqué par défaut, sous "Options avancées" + tooltip "Laisser à 0 si la plateforme avance les frais"
- ✅ En-tête accordéon enrichi : `🇨🇩 Kinshasa · Aérien · Express · 2-3j`

**`CbmTiersEditor.tsx` → renommé `VolumeTiersEditor.tsx`** :
- ✅ Titre dynamique : "Paliers Poids (kg)" si mode=air, "Paliers CBM (m³)" sinon
- ✅ Libellés `$/kg` ou `$/CBM` selon mode

**`PieceTiersEditor.tsx`** :
- ✅ Option `$/kg` ajoutée au select d'unité (mode air uniquement)

**Nouveau `SurchargesEditor.tsx`** :
- ✅ Sélecteur catégorie (électronique, fragile, dangereux…)
- ✅ Type : Fixe par kg / Fixe par CBM / Fixe par commande / % (en dernier)
- ✅ Montant + devise

**`ForwardersList.tsx`** :
- ❌ Suppression bouton `×` Multiplicateurs + `ForwarderTiersDialog.tsx` supprimé
- ✅ Compteur de profils actifs par transitaire
- ✅ Bouton "Lier à un compte transporteur" (crée/relie un user `forwarder`)

### LOT 3 — Page Logistique

**`AdminLogistiquePage.tsx`** :
- ✅ Ajout d'une 4ème carte de stats : **Transitaires** (compteur)
- ✅ Onglet "Transitaires" listant les transitaires liés à un compte transporteur (peuvent gérer leurs propres expéditions)

### LOT 4 — Moteur de devis unifié + branchement Checkout

**Nouvelle Edge Function `quote-shipping`** :
- Input : `{ delivery_address, cart_items, store_id }`
- Output : `[{ forwarder, mode, service_class, total, transit_days, deposit_required }]`
- Logique :
  1. Résout `country_code + city_id` depuis l'adresse
  2. Filtre les `forwarder_pricing_profiles` couvrant cette destination
  3. Pour chaque profil : appelle `quote_forwarder()` avec poids/CBM panier
  4. Filtre les profils dont les `restrictions` bloquent un produit du panier
  5. Trie par prix croissant + délai

**Checkout** : remplace l'appel actuel à `shipping_routes` par `quote-shipping` → le client ne voit que les transitaires éligibles.

**Paramètres globaux** : on garde **uniquement** délais par défaut **fallback** (utilisés si transitaire n'a pas renseigné). Tooltip explicite.

---

## 4. Réponses directes à tes questions

| Ta question | Réponse |
|---|---|
| Pourquoi je vois toujours "Paliers CBM" en Aérien ? | Migration jamais appliquée en DB. Le LOT 1 corrige ça. |
| Pourquoi seulement 19 villes ? | Seules 20 villes RDC en base. Le LOT 1 ajoute les 30+ manquantes liées aux 26 provinces. |
| Pays en saisie libre = bug ? | Oui. LOT 2 = sélecteur basé sur pays actifs plateforme. |
| Pourquoi surcharges en % ? | Choix initial discutable. LOT 1 + 2 = fixe par défaut, % optionnel. |
| Acompte % toujours visible ? | LOT 2 = masqué par défaut sous "Options avancées". |
| Zones dernier km : encore utiles ? | OUI, ne pas supprimer. Elles complètent (commune/quartier) ce que les transitaires ne font pas. Restent telles quelles, juste branchées sur géo unifiée. |
| Délais de livraison globaux ? | Gardés comme **fallback uniquement** (si profil transitaire vide). Tooltip à ajouter. |
| Simulateur vs Calculateur dynamique ? | Doublon historique. LOT 4 = un seul moteur `quote-shipping`. Le calculateur dynamique (`shipping_routes`) passe en mode legacy/désactivable. |
| Transitaires dans Logistique ? | LOT 3 = ajout compteur + onglet. Liaison optionnelle vers compte transporteur via `linked_transporter_user_id`. |

---

## 5. Livrables après approbation

1. 📄 **Fichier SQL téléchargeable** dans `/mnt/documents/PROD_MIGRATION_05_freight_unified_foundation.sql` (idempotent, à passer staging puis prod)
2. 🔧 Modifs UI admin (LOT 2 + LOT 3)
3. ⚡ Nouvelle Edge Function `quote-shipping` + branchement checkout (LOT 4)
4. 📝 Migration interne `frontend/supabase/migrations/<ts>_freight_unified_foundation.sql` jumelle du fichier prod

Si tu approuves, je propose qu'on **commence par les LOTS 1 + 2** dans une première itération (DB + UI admin), puis LOTS 3 + 4 (logistique + checkout) dans une seconde — pour limiter le risque sur ta prod 4000 users/jour.
