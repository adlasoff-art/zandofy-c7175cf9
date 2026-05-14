## Plan de correction

1. **Ajouter une migration SQL idempotente**
   - Créer une nouvelle migration dans le répertoire source de vérité des migrations.
   - Redéfinir `public.is_operator_owner(uuid, uuid)` en `SECURITY DEFINER` avec `search_path=public`.
   - Donner explicitement le droit `EXECUTE` à `authenticated` et `service_role` sur `is_operator_owner`.
   - Appliquer aussi le même durcissement préventif aux helpers RLS proches (`is_operator_rider`, `user_owns_any_operator`) pour éviter la prochaine erreur du même type.

2. **Stabiliser les policies concernées**
   - Rejouer les policies `delivery_operator_riders` et `delivery_operator_rider_invites` sans ouvrir les données publiquement.
   - Les owners voient uniquement les riders/invitations de leur opérateur.
   - Les admins/managers gardent l’accès staff existant.
   - Les riders voient uniquement leur propre rattachement.

3. **Fournir un SQL exécutable en production**
   - Générer un fichier SQL autonome à appliquer côté base de production.
   - Inclure des requêtes de vérification ciblées pour l’Operator ID `abbbc968-1180-4b07-86d7-4ceaaf274a8e` : privilège de fonction, nombre de riders, invitations pendantes, policies actives.

4. **Validation attendue**
   - Après exécution du SQL en production, la page `/operator/fleet` ne doit plus afficher :
     - `Riders : permission denied for function is_operator_owner`
     - `Invitations : permission denied for function is_operator_owner`
   - La flotte doit afficher les lignes présentes dans `delivery_operator_riders` pour l’opérateur `abbbc968-1180-4b07-86d7-4ceaaf274a8e`, ou seulement les invitations pendantes si le livreur n’a pas encore de rattachement effectif.