## Contexte

Le RLS prod est désormais corrigé (les 8 lignes `can_execute = true` le confirment). La page `/operator/fleet` charge donc bien le livreur `76004fb4…` au statut **KYC requis**. Mais en l'état, l'opérateur ne peut pas réellement **piloter** son livreur : la fiche n'affiche qu'un UUID tronqué, aucune information d'identité, aucune action concrète sur le KYC, et la transition `kyc_required → active` n'est ni visible ni relançable.

Le plan ci-dessous comble ce trou opérationnel sans toucher à la business logic des courses.

## Objectif

Permettre à l'opérateur de :
1. **Identifier** chaque livreur (nom, email, téléphone, photo, véhicule + plaque).
2. **Voir précisément où en est le KYC** du livreur et **le relancer** (rappel email).
3. **Suivre l'activité** d'un livreur actif (livraisons, taux d'acceptation, note moyenne).
4. **Vérifier que la bascule automatique `kyc_required → active`** fonctionne dès que le KYC est validé côté admin.

## Périmètre

### 1. Fiche livreur enrichie (UI — `OperatorFleetPage.tsx`)
- Joindre `profiles` (full_name, email, phone, avatar_url) sur `rider_user_id` via une requête séparée + map (RLS profiles déjà permissive sur ce champ — à confirmer pendant l'implémentation, sinon vue dédiée `v_operator_riders_public` côté DB).
- Afficher : avatar + nom complet (fallback email) + téléphone cliquable, véhicule **et plaque**, date d'invitation, date d'activation.
- Garder l'UUID tronqué en sous-titre debug, plus discret.

### 2. Bloc "KYC" actionnable pour les statuts `kyc_required` / `pending`
- Lire `kyc_status` du rider depuis `profiles` ou table KYC (à identifier : `use-kyc.ts` / `use-kyb-kyc-v2.ts`).
- Afficher l'étape bloquante (pièce d'identité manquante, selfie, etc.).
- Bouton **"Relancer le livreur par email"** → appelle un edge function léger `operator-remind-rider-kyc` (ou réutilise `operator-invite-rider` en mode reminder) qui renvoie un mail templaté avec le lien d'onboarding KYC. Throttle 24h côté DB pour éviter le spam.

### 3. Transition automatique `kyc_required → active`
- Vérifier l'existence d'un trigger sur `profiles.kyc_status = 'approved'` qui passe les `delivery_operator_riders.status` correspondants à `active` (en respectant le quota `max_riders`).
- S'il n'existe pas : créer la fonction + trigger dans une nouvelle migration (`20260515_xxxxx_auto_activate_rider_on_kyc.sql`). Notification push/email à l'opérateur à l'activation.

### 4. Mini-dashboard activité par livreur (statut `active` uniquement)
- Compteur livraisons (30 j) + note moyenne + taux d'acceptation, lus depuis les vues existantes (`v_operator_rider_stats` si elle existe, sinon agrégat à la volée sur `orders`).
- Affichés en ligne sous la carte du livreur, sans page dédiée pour rester scoped.

### 5. QA prod
- Rejouer la nouvelle migration sur **staging puis prod** (cf. memory `rls-staging-prod-divergence`).
- Tester avec l'opérateur `abbbc968…` et son livreur `76004fb4…` :
  - identité visible,
  - bouton "Relancer KYC" fonctionnel,
  - simulation de validation KYC → bascule auto en `active`,
  - widget activité s'affiche après activation.

## Détails techniques

```text
OperatorFleetPage
├── useQuery riders (existant)
├── useQuery profiles_by_ids (NOUVEAU, batch sur rider_user_id[])
├── useQuery kyc_status_by_ids (NOUVEAU, RPC `get_riders_kyc_overview`)
└── RiderCard (refonte)
    ├── Header : avatar + nom + email + tel + UUID(debug)
    ├── Body  : véhicule + plaque + dates
    ├── Si status ∈ {pending, kyc_required} : bloc KYC + bouton Relancer
    └── Si status = active : widget stats (30j)

DB (nouvelle migration)
├── FUNCTION public.get_riders_kyc_overview(_operator_id uuid)
│     RETURNS TABLE(rider_user_id uuid, kyc_status text, missing_steps text[])
│     SECURITY DEFINER, GRANT EXECUTE TO authenticated
├── FUNCTION public.auto_activate_rider_on_kyc()
│     TRIGGER AFTER UPDATE OF kyc_status ON profiles
│     → UPDATE delivery_operator_riders SET status='active', activated_at=now()
│       WHERE rider_user_id = NEW.id AND status = 'kyc_required'
│       (respect du quota max_riders)
└── COLUMN delivery_operator_riders.last_kyc_reminder_at timestamptz (throttle)

Edge function (nouvelle)
└── supabase/functions/operator-remind-rider-kyc/index.ts
    - verify_jwt = true
    - vérifie is_operator_owner(auth.uid(), operator_id)
    - vérifie last_kyc_reminder_at < now() - 24h
    - envoie email via _shared/email.ts
    - met à jour last_kyc_reminder_at
```

## Hors-scope (à traiter ailleurs si besoin)

- Refonte complète des stats opérateur (déjà couverte par `OperatorPerformanceWidget`).
- Modification du flux KYC côté livreur (page Onboarding) — on relance, on ne réécrit pas.
- Multi-opérateur par livreur (un rider peut appartenir à un seul opérateur en l'état).

## Livrables

- 1 migration SQL (rejouée staging + prod).
- 1 edge function `operator-remind-rider-kyc`.
- Refonte de `OperatorFleetPage.tsx` (carte livreur + bloc KYC + widget activité).
- Mise à jour de la mémoire `multi-operator-delivery-system` avec le nouveau flux d'activation auto.