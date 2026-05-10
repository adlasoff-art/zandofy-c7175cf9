## Plan de correction ciblée

1. Mettre à jour `keccel-cardpay` dans les deux emplacements synchronisés :
   - `frontend/supabase/functions/keccel-cardpay/index.ts`
   - `supabase/functions/keccel-cardpay/index.ts`

2. Aligner le payload CardPay sur le format déjà utilisé par le flux abonnement qui fonctionne comme référence interne :
   - conserver `merchantcode`, `reference`, `currency`, `description`, `callbackurl`, `returnUrl`
   - repasser `amount` en nombre brut au lieu de string formatée, car le flux abonnement envoie `amount` directement et l’erreur restante est redevenue générique.

3. Améliorer légèrement le diagnostic sans exposer de secret :
   - garder le log payload avec `merchantcode` masqué
   - ajouter un message d’erreur utilisateur qui affiche les détails Keccel quand ils existent déjà.

4. Validation attendue :
   - redéploiement via GitHub Actions comme précédemment
   - retest carte.
   - si Keccel renvoie encore “Missing parameter” sans nom, il faudra comparer avec leur documentation exacte ou tester leur exigence sur un champ supplémentaire non présent dans l’intégration actuelle.