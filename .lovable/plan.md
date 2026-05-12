## Diagnostic

Le problème est identifié : côté frontend, `OperatorFleetPage.tsx` envoie le champ `email`, alors que l’Edge Function `operator-invite-rider` attend `rider_email`.

Résultat : selon la version déployée en production, l’email peut partir, mais le client reçoit/interprète une erreur non-2xx et affiche le toast générique `Edge Function returned a non-2xx status code`.

## Plan de correction

1. **Aligner le payload frontend avec l’Edge Function**
   - Modifier l’appel dans `frontend/src/pages/operator/OperatorFleetPage.tsx` pour envoyer :
     - `rider_email: inviteEmail.trim().toLowerCase()`
     - `vehicle_type: inviteVehicle`
   - Ne plus envoyer `email` comme champ principal.
   - Garder `full_name` seulement si nécessaire côté UI, mais ne pas dépendre de lui côté fonction.

2. **Rendre l’Edge Function rétrocompatible**
   - Adapter `operator-invite-rider/index.ts` pour accepter temporairement `email` OU `rider_email`.
   - Normaliser en interne vers `rider_email`.
   - Objectif : éviter que d’anciens clients encore en cache ou pas encore republiés cassent l’invitation.

3. **Améliorer le message d’erreur côté UI**
   - Lire `data?.error` / `error.message` quand l’appel échoue.
   - Afficher un message métier clair au lieu du toast brut `Edge Function returned a non-2xx status code`.

4. **Synchroniser les deux sources Edge Functions du repo**
   - Appliquer la correction dans `frontend/supabase/functions/operator-invite-rider/index.ts` pour la prod GitHub Actions.
   - Appliquer la même correction dans `supabase/functions/operator-invite-rider/index.ts` pour la preview Lovable.

5. **Redéployer la fonction preview après modification**
   - Redéployer `operator-invite-rider` côté Lovable Cloud pour valider immédiatement.
   - Pour la production, la correction passera par le workflow GitHub habituel vers `main`.

## Vérification prévue

- Tester l’appel direct avec le payload actuel du formulaire (`email`) : doit répondre `200`.
- Tester l’appel avec le payload corrigé (`rider_email`) : doit répondre `200`.
- Confirmer que l’UI ne montre plus le toast d’erreur si l’invitation est effectivement envoyée.