## Objectif
Remplacer les essais successifs par un diagnostic fiable de l’erreur `Keccel 1 : Missing parameter`, avec preuves exploitables et rollback propre.

## Plan proposé

1. **Geler les changements fonctionnels**
   - Ne plus modifier au hasard les noms ou formats de champs envoyés à Keccel.
   - Stabiliser une seule version de `keccel-cardpay` dans les deux emplacements utilisés par le projet.

2. **Ajouter un mode diagnostic contrôlé dans `keccel-cardpay`**
   - Générer un `diagnostic_id` unique par tentative.
   - Journaliser côté fonction :
     - liste exacte des champs envoyés à Keccel,
     - type de chaque champ (`number`, `string`, etc.),
     - longueurs utiles (`reference`, `description`, URLs),
     - présence/absence des secrets sans afficher les valeurs,
     - URL appelée,
     - statut HTTP,
     - réponse brute complète de Keccel.
   - Masquer strictement `merchantcode`, token, données utilisateur sensibles.

3. **Retourner le `diagnostic_id` dans le toast / réponse frontend**
   - Quand Keccel renvoie `Missing parameter`, l’utilisateur voit aussi un identifiant court.
   - Cet identifiant permet de retrouver exactement la tentative correspondante dans les logs, sans deviner.

4. **Créer une sonde de comparaison avec le flux qui marche**
   - Ajouter temporairement une comparaison structurée entre :
     - payload `subscribe-payment` qui est supposé fonctionner,
     - payload `keccel-cardpay` qui échoue.
   - Comparer noms de champs, types, longueurs, valeurs nulles/vides, merchant code, return/callback URLs.

5. **Ajouter une validation locale avant appel Keccel**
   - Bloquer immédiatement si un champ requis est vide, `undefined`, trop long ou d’un type suspect.
   - Le message d’erreur interne dira précisément quel champ est invalide avant même d’appeler Keccel.

6. **Mettre en place un test reproductible côté Edge Function**
   - Tester la fonction déployée avec une commande contrôlée ou via l’outil Edge Function.
   - Confirmer si l’appel atteint Keccel et récupérer la réponse brute.
   - Ne pas considérer le fix comme terminé tant qu’on n’a pas :
     - les logs d’une tentative réelle,
     - le payload exact,
     - la réponse brute Keccel.

7. **Nettoyage après diagnostic**
   - Une fois la cause identifiée, appliquer une correction unique.
   - Retirer ou réduire les logs de diagnostic trop verbeux.
   - Garder uniquement un logging minimal sécurisé : `diagnostic_id`, code Keccel, statut HTTP, champs présents.

## Hypothèse principale à vérifier
Le problème n’est probablement plus “quel champ essayer ensuite”, mais l’un de ces écarts :
- champ requis par CardPay absent mais non documenté dans notre code,
- nom exact attendu différent (`returnUrl` vs autre casse),
- `merchantcode` ou token non adapté au endpoint CardPay,
- type/format refusé par Keccel malgré présence du champ,
- callback/return URL rejetée,
- production pas réellement déployée avec la dernière version.

## Critère de succès
Après implémentation, chaque échec Keccel doit produire un diagnostic traçable permettant de dire précisément :
- ce qui a été envoyé,
- ce que Keccel a répondu,
- quelle différence existe avec le flux fonctionnel,
- quelle correction finale appliquer.