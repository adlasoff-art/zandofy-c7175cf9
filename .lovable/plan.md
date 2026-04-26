Plan de correction prioritaire pour fiabiliser la production avant présentation.

Constat principal après inspection du code : aujourd’hui le checkout marque `shipping_payment_status = paid` dès la création de la commande si le client a choisi “payer maintenant”, avant la confirmation réelle du paiement. Si KelPay échoue ou expire, le statut global passe bien à `payment_failed`, mais l’expédition reste “Payée”. C’est la cause du problème grave signalé.

## Lot 1 — Sécuriser paiement commande vs expédition
Objectif : une expédition ne peut jamais être “payée” si le paiement global a échoué.

Actions :
- Dans `CheckoutPage.tsx`, remplacer le marquage immédiat `shipping_payment_status: "paid"` par un statut d’attente tant que le paiement n’est pas confirmé.
- Même logique pour `last_mile_payment_status` quand il est payé avec la commande.
- Quand le paiement commande est confirmé par KelPay/Keccel : seulement à ce moment-là, passer :
  - commande `awaiting_payment` → `pending`
  - expédition incluse dans le paiement → `paid`
  - livraison dernier km incluse → `paid`
- Quand le paiement échoue/expire/est annulé : passer :
  - commande → `payment_failed`
  - expédition non différée → `failed` ou `unpaid`
  - dernier km non différé → `failed` ou `unpaid`
- Corriger les boutons “annuler attente”, timeout 3 minutes, vérification manuelle et realtime pour qu’ils appliquent aussi cette synchronisation.

## Lot 2 — Backend functions paiement
Objectif : éviter qu’un webhook/callback mette à jour seulement le statut global sans synchroniser la logistique.

Actions :
- Mettre à jour les fonctions de paiement :
  - `kelpay-callback`
  - `kelpay-webhook`
  - `kelpay-check`
  - `expire-pending-orders`
- Sur succès `payment_type = order`, mettre à jour les statuts logistiques inclus dans le paiement.
- Sur échec `payment_type = order`, nettoyer les statuts logistiques qui auraient été laissés à tort en “paid”.
- Conserver la logique des paiements séparés `payment_type = shipping` et `payment_type = last_mile` : ceux-là ne doivent marquer “paid” que le flux réellement payé.

## Lot 3 — Migration SQL de garde-fou + nettoyage
Objectif : empêcher les incohérences actuelles et corriger les commandes déjà touchées.

Migration prévue :
- Ajouter/mettre à jour une fonction SQL de synchronisation des statuts de paiement logistique lors des changements de statut commande.
- Créer un trigger sur `orders` : si `status = payment_failed`, alors toute expédition/livraison marquée `paid` sans preuve de paiement séparé est remise en statut non payé/échoué.
- Ajouter les politiques nécessaires si certaines mises à jour admin/RPC sont bloquées.
- Inclure un bloc de nettoyage des données existantes : commandes `payment_failed` avec `shipping_payment_status = paid` seront corrigées.

Je fournirai ensuite le fichier SQL téléchargeable pour ta base de production, comme pour la migration précédente.

## Lot 4 — Corriger l’onglet Ventes du dashboard
Objectif : ne plus mélanger commandes réussies, échouées et annulées.

Actions dans `SalesTab.tsx` :
- Définir clairement les familles :
  - réussies/validées : paiement confirmé ou statut opérationnel réellement actif/livré selon les règles existantes
  - échouées/annulées : `payment_failed`, `cancelled`, `returned`
  - brutes : total actuel sans différenciation
- Graphique “Ventes par jour” :
  - barre verte = revenu validé réel
  - barre bleue = nombre de commandes valides
  - barre rouge = nombre de commandes échouées/annulées
- Graphique “Évolution du chiffre d’affaires cumulatif” :
  - courbe verte = CA réellement validé/perçu
  - courbe rouge = cumul échoué/annulé
  - courbe grise = cumul brut historique, pour comparaison
- Graphique “CA cumulé par vendeur” :
  - barre verte = CA validé
  - barre rouge = CA échoué/annulé
  - barre grise = brut/total comparatif si lisible sans surcharger.
- Adapter tooltips/légendes pour que l’équipe comprenne immédiatement ce qui est réellement encaissé.

## Lot 5 — Améliorer l’onglet Commandes admin
Objectif : tri plus pratique et détail financier plus clair.

Actions dans `AdminOrdersPage.tsx` :
- Ajouter un filtre par date :
  - aujourd’hui
  - 7 jours
  - 30 jours
  - plage personnalisée
- Afficher dans le détail d’une commande :
  - produits commandés
  - petite image si disponible
  - nom produit cliquable vers sa fiche produit
  - quantité/prix
- Éclater le total :
  - articles/sous-total
  - remise/coupon
  - expédition
  - livraison dernier km
  - total final
- Ajouter une action de suppression groupée protégée uniquement pour les commandes sélectionnées en statut terminal (`payment_failed`, `cancelled`, `returned`), avec confirmation explicite, afin d’éviter l’accumulation inutile sans risque sur les commandes actives.

## Lot 6 — Corriger la modération des avis
Objectif : quand l’admin clique “approuver”, l’avis doit quitter “En attente” et passer dans “Approuvés”.

Constat code : la page met à jour `is_approved`, `approved_by`, `approved_at`, mais les migrations visibles ne montrent pas clairement ces colonnes ni une politique admin complète sur `reviews`. Cela peut expliquer le toast de succès apparent sans changement réel ou un comportement incohérent.

Actions :
- Migration pour garantir les colonnes nécessaires :
  - `is_approved boolean default false`
  - `approved_by uuid null`
  - `approved_at timestamptz null`
  - `reward_granted boolean default false` si absent
- Ajouter une policy admin/manager pour gérer les avis produits.
- Remplacer l’update frontend direct par un RPC sécurisé `approve_review(review_id)` si nécessaire, pour :
  - approuver l’avis
  - renseigner l’admin et la date
  - créditer les points bonus si éligible sans double crédit
- Améliorer l’invalidation React Query pour rafraîchir immédiatement les onglets `En attente`, `Approuvés`, `Tous`.

## Lot 7 — Vérification rapide après implémentation
Je vérifierai par lecture/build que :
- une commande `payment_failed` ne peut plus afficher “Expédition : Payée” ;
- les graphiques séparent vert/rouge/gris ;
- l’admin peut filtrer les commandes par date ;
- les produits et le breakdown total sont visibles dans le détail commande ;
- l’approbation d’avis change réellement l’état.

## Détails techniques importants
- Il y aura bien une migration SQL, car le correctif avis et le garde-fou statut paiement nécessitent une protection côté base.
- Les changements frontend/backend devront être poussés vers GitHub puis déployés selon ton workflow production.
- Le nettoyage des anciennes données sera inclus dans la migration, mais limité aux incohérences évidentes : commandes `payment_failed` dont l’expédition/livraison est encore marquée “paid”.
- Je ne toucherai pas aux fichiers d’infrastructure, Docker, ports, domaines ou règles Cursor/AGENTS.