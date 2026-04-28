---
name: Geo fields combobox standard
description: Tous formulaires Pays/Province/Ville/Commune/Quartier doivent utiliser comboboxes liés aux Zones Géographiques admin (jamais saisie libre)
type: preference
---

**Règle plateforme (Phase 10.3)** : aucun champ pays/province/ville/commune/quartier ne doit être un `<Input>` en saisie libre, ni une saisie ISO manuelle.

**Composants à utiliser** :
- `CountryCombobox` (`@/components/vendor/CountryCombobox`) — pays avec drapeaux + filtre `activeCountryCodes` via `useActiveGeo`
- `GeoCombobox` (`@/components/address/GeoCombobox`) — combobox générique
- `GeoFieldsRow` (`@/components/address/GeoFieldsRow`) — wrapper standardisé compact, niveaux configurables (`country`, `province`, `city`, `commune`, `quartier`)
- `CascadingAddressFields` (`@/components/address/CascadingAddressFields`) — formulaire d'adresse complet (avec adresse manuelle libre)
- `LocationHierarchyFilter` (`@/components/admin/LocationHierarchyFilter`) — filtres en lecture (admin)

**Données** : les comboboxes lisent les tables admin `countries`, `provinces`, `cities`, `communes`, `quartiers` (filtre `is_active = true`) via `useGeoData`. Une ville non configurée doit afficher un warning "demandez à un admin d'ajouter la ville via Zones Géographiques".

**Why** : facilite la saisie pour les utilisateurs (codes ISO non maîtrisés), garantit l'interconnexion avec le système de zones géographiques admin (plafonds, tarifs, blocage géo, segmentation notifs), et évite les divergences orthographiques entre formulaires.

**How to apply** : pour tout nouveau formulaire ou refactor touchant à la géographie, importer `GeoFieldsRow` ou `CascadingAddressFields`. Stocker à la fois le nom (texte legacy) et l'UUID quand disponible. Formulaires déjà alignés : AdminOperatorRateCapsPage, AdminShippingPage (ZoneDialog), OperatorRatesPage, OperatorCoveragePage, BecomeForwarderPage (HQ + routes), ForwarderPricingProfilesDialog, ForwarderCoverageDialog, AuthPage, BecomeOperatorPage, DashboardPage, CheckoutPage, KycSubmissionForm, **VendorDashboardPage (Localisation boutique — colonnes `country_code`, `province_id`, `city_id`, `commune_id` sur `stores`, legacy `country`/`city` text conservés pour rétrocompat étiquettes)**.
