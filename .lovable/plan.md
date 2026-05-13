## Problème

L'edge function `operator-invite-rider` filtre strictement `delivery_operators.owner_user_id = auth.uid()` et renvoie « Aucun opérateur trouvé » dès que l'appelant n'est pas l'owner direct (cas confirmé : tu testes en prod avec un compte admin / owner légitime mais dont l'`owner_user_id` ne matche pas la ligne `delivery_operators` ciblée).

Aujourd'hui c'est aussi un blocage UX : un admin plateforme ne peut pas inviter au nom d'un opérateur, et un owner légitime mal rattaché reste bloqué sans diagnostic.

## Objectif

1. Permettre à un admin d'inviter pour n'importe quel opérateur via un `operator_id` explicite.
2. Garder la sécurité : un non-admin reste limité à son propre opérateur (owner).
3. Donner un message d'erreur clair indiquant **quel** `auth.uid()` a été reçu et pourquoi le lookup a échoué (pour diagnostiquer rapidement les cas "owner légitime mais pas matché en prod").
4. Côté UI : si l'utilisateur est admin et n'a pas d'opérateur owner, proposer un sélecteur d'opérateur dans la modale d'invitation.

## Changements

### Edge function `operator-invite-rider` (frontend/supabase/functions + supabase/functions, à dupliquer)

- Ajouter un champ optionnel `operator_id` dans le `BodySchema`.
- Charger les rôles de l'appelant via `user_roles` (service role).
- Logique de résolution de l'opérateur :
  1. Si `operator_id` fourni :
     - admin → autorisé directement.
     - non-admin → vérifier qu'il est owner de cet `operator_id`, sinon 403.
  2. Sinon : fallback actuel (lookup par `owner_user_id`).
- En cas d'absence d'opérateur, retourner un 404 explicite incluant `auth_user_id` et un hint (« Vous n'êtes pas owner d'un opérateur. Contactez un admin ou passez `operator_id`. ») pour faciliter le debug prod.
- Conserver tout le reste (quota, invitation persistée, email Resend, JSON `request_id`).

### Frontend `OperatorFleetPage.tsx` + modale d'invitation

- Lire le rôle admin via `useRoles()`.
- Si admin et pas d'opérateur owner détecté (ou multi-opérateurs) : afficher un `Select` listant les opérateurs (`delivery_operators` triés par `company_name`) ; sinon comportement inchangé.
- Passer `operator_id` à l'invocation de l'edge function quand la sélection admin est utilisée.
- Améliorer l'affichage d'erreur : déjà en place via `error.context.json()`, on s'assure d'afficher le nouveau hint.

### Diagnostic prod (à exécuter par toi sur `supabasa.zandofy.com`)

Aucun changement DB requis. SQL de vérification à lancer :

```sql
-- 1) L'opérateur existe-t-il et qui est owner ?
select id, company_name, owner_user_id, status, is_active
from public.delivery_operators
order by created_at desc;

-- 2) L'email avec lequel tu es loggué correspond-il à cet owner ?
select p.id as profile_id, p.email, array_agg(ur.role) as roles
from public.profiles p
left join public.user_roles ur on ur.user_id = p.id
where p.email ilike '<TON_EMAIL>'
group by p.id, p.email;
```

Si `profile_id` ≠ `delivery_operators.owner_user_id`, tu sauras que c'est un mismatch data prod (à corriger par un `update` ciblé ou via la nouvelle option admin + `operator_id`).

## Hors scope

- Pas de migration DB.
- Pas de modification des règles RLS.
- Pas de refonte du flux d'acceptation `operator-accept-rider-invite` (déjà OK).

## Validation

1. En tant qu'admin sans operator owner : ouvrir la modale → sélectionner un opérateur → invitation OK, ligne `delivery_operator_rider_invites` créée, email envoyé.
2. En tant qu'owner classique : flux inchangé, pas de sélecteur affiché.
3. Tentative non-admin avec `operator_id` d'un autre opérateur → 403 explicite.
4. Erreur "no operator" affiche désormais le hint + `auth_user_id` dans le toast.
