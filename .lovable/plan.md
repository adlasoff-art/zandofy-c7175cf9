## Constat immédiat

Le toast montre bien `diag cf2024fd`, donc la fonction a généré une tentative traçable. Pourtant, aucun log `cf2024fd` ni aucun appel récent `keccel-cardpay` n’apparaît dans les logs Lovable Cloud que je peux consulter ici. Cela indique très probablement que le paiement testé passe par l’environnement staging/production réel, pas par le backend preview Lovable, ou que les logs runtime ne sont pas exploitables comme source de vérité.

## Objectif

Arrêter les corrections à l’aveugle et produire une preuve exacte : payload envoyé à Keccel, environnement utilisé, réponse brute Keccel, puis correction unique.

## Plan proposé

1. **Geler le payload actuel**
   - Ne plus modifier les noms de champs ou formats sans preuve.
   - Garder `keccel-cardpay` identique dans `supabase/functions/` et `frontend/supabase/functions/`.

2. **Remplacer les logs volatils par une trace persistante**
   - Ajouter une table de diagnostic dédiée aux tentatives CardPay.
   - Chaque tentative écrit : `diagnostic_id`, environnement, fonction, `order_id`, référence, montant, devise, URL callback/return, noms de champs envoyés, types, statut HTTP Keccel, réponse brute Keccel masquée, horodatage.
   - Ne jamais stocker le token ni le merchant code complet.

3. **Écrire la trace avant et après l’appel Keccel**
   - Avant l’appel : sauvegarder le payload shape envoyé.
   - Après l’appel : sauvegarder `HTTP status`, `code`, `description`, `checkoutUrl présent/ou non`.
   - Si Keccel répond `Missing parameter`, on saura exactement quel payload était associé au `diag`.

4. **Retourner un diagnostic exploitable au frontend**
   - Le toast garde le `diag`.
   - La réponse inclut seulement les infos non sensibles nécessaires : `diagnostic_id`, `sent_keys`, `field_shape`, `keccel_code`, `keccel_description`.

5. **Créer un script de comparaison contrôlé**
   - Comparer automatiquement le payload du flux abonnement qui fonctionne avec le flux commande qui échoue.
   - Sortie attendue : différences de champs, types, longueurs, URLs, montant, référence, merchant env.

6. **Vérifier le vrai environnement ciblé**
   - Confirmer quelle URL backend est appelée par le frontend testé : preview, staging ou production.
   - Ne pas conclure depuis Lovable Cloud si le test vient de `zandofy.com` ou `studio.zandofy.com`.

7. **Correction unique puis nettoyage**
   - Une fois la cause identifiée, appliquer une seule correction ciblée.
   - Réduire ensuite le diagnostic : garder uniquement `diagnostic_id`, statut, code Keccel et erreur masquée pendant une courte période.

## Résultat attendu

À la prochaine erreur `Missing parameter`, on ne devine plus : on ouvre la ligne du diagnostic correspondant et on voit précisément ce que Keccel a reçu, dans quel environnement, et pourquoi la passerelle refuse la requête.