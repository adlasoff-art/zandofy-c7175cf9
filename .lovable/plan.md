Diagnostic actuel

- Cause principale probable : `operator-invite-rider` n’enregistre rien dans `delivery_operator_riders` si l’email invité n’a pas encore de compte. La fonction envoie donc l’email, retourne parfois un succès, mais la flotte reste vide car `delivery_operator_riders.rider_user_id` est `NOT NULL` et ne peut pas représenter un invité non inscrit.
- Le parcours email n’a pas de jeton d’invitation ni de page d’acceptation. Le lien redirige simplement vers `/auth?redirect=/rider` ou `/rider`, donc après création de compte/KYC il n’existe aucun mécanisme fiable pour rattacher automatiquement ce compte à l’opérateur.
- Le message générique `Edge Function returned a non-2xx status code` vient aussi du SDK : sur réponse non-2xx, le corps JSON de l’erreur n’est pas lu automatiquement. Il faut parser `error.context` côté frontend pour afficher la vraie erreur.
- Point de vigilance prod : le workflow déploie depuis `frontend/supabase/functions`. Les corrections doivent donc être appliquées dans le chemin réellement déployé, puis synchronisées avec le dossier miroir si nécessaire.

SQL de diagnostic à exécuter côté prod si tu veux confirmer avant correction

```sql
-- 1) Vérifier l’opérateur et le quota
select o.id, o.company_name, o.owner_user_id, o.status, o.is_active, o.max_riders,
  (select count(*) from public.delivery_operator_riders r where r.operator_id = o.id) as riders_total,
  (select count(*) from public.delivery_operator_riders r where r.operator_id = o.id and r.status in ('pending','kyc_required','active')) as riders_quota
from public.delivery_operators o
where o.company_name ilike '%Very Speed%';

-- 2) Vérifier si des lignes riders existent mais ne sont pas visibles en UI
select r.id, r.operator_id, r.rider_user_id, p.email, r.vehicle_type, r.status, r.invited_at
from public.delivery_operator_riders r
left join public.profiles p on p.id = r.rider_user_id
where r.operator_id = '<OPERATOR_ID>'
order by r.invited_at desc;

-- 3) Vérifier si le compte invité existe bien côté profils
select id, email, first_name, last_name, created_at
from public.profiles
where lower(email) = lower('<EMAIL_INVITE>');

-- 4) Vérifier le rôle livreur du compte invité
select ur.user_id, p.email, ur.role, ur.created_at
from public.user_roles ur
left join public.profiles p on p.id = ur.user_id
where lower(p.email) = lower('<EMAIL_INVITE>');
```

Plan de correction

1. Corriger le modèle d’invitation
   - Ajouter une table `delivery_operator_rider_invites` pour stocker les invitations avant création du compte : opérateur, email, véhicule, statut, jeton sécurisé, expiration, dates d’acceptation/révocation.
   - Garder `delivery_operator_riders` pour les livreurs déjà rattachés avec un vrai `rider_user_id`.
   - Ajouter les index/contraintes pour éviter les doublons par opérateur + email.

2. Réécrire `operator-invite-rider` de manière stable
   - Valider l’utilisateur appelant et l’opérateur propriétaire.
   - Vérifier le quota en comptant `active/pending/kyc_required` + invitations encore ouvertes.
   - Si l’email correspond à un compte existant : créer ou remettre à jour la ligne `delivery_operator_riders`, ajouter le rôle `rider`, puis envoyer un lien direct vers `/rider`.
   - Si l’email n’a pas encore de compte : créer/mettre à jour une invitation persistée, puis envoyer un lien avec token vers `/auth?mode=signup&invite=<token>&redirect=/rider-invite`.
   - Retourner un JSON explicite même en cas de conflit : `success`, `message`, `invite_status`, `rider_created`.

3. Ajouter l’acceptation d’invitation
   - Créer une fonction `operator-accept-rider-invite` qui, une fois le livreur connecté, vérifie le token + email du compte, crée `delivery_operator_riders`, ajoute le rôle `rider`, puis marque l’invitation comme acceptée.
   - Si le KYC est requis/non approuvé, créer le rattachement en statut `kyc_required` ou `pending` selon la règle métier, avec message clair.

4. Corriger le parcours frontend
   - Sur la page Auth, respecter `redirect` après login/signup au lieu de toujours renvoyer vers `/`.
   - Ajouter une page `/rider-invite` qui consomme le token, appelle la fonction d’acceptation, puis dirige vers KYC ou `/rider` avec un message clair.
   - Dans `OperatorFleetPage`, afficher aussi les invitations ouvertes afin que l’opérateur voie “Invitation envoyée / en attente de création de compte”, au lieu de “Aucun livreur”.

5. Corriger l’affichage de l’erreur Edge Function
   - Dans `OperatorFleetPage`, si `supabase.functions.invoke` retourne une erreur non-2xx, parser `error.context.json()` pour afficher la vraie erreur backend au lieu du message générique.
   - Ajouter des logs structurés côté fonction avec un `request_id` pour tracer les échecs sans exposer de données sensibles.

6. Validation
   - Tester les 3 cas : email sans compte, email avec compte sans KYC, email avec compte déjà rattaché.
   - Vérifier que l’email arrive, que la flotte montre une invitation/livreur, que le clic email arrive au bon écran, et que les erreurs affichent le vrai message.
   - Préparer les changements dans les chemins utilisés par la prod (`frontend/supabase/functions`, migrations, frontend), puis laisser GitHub/Cursor intégrer vers staging puis main.