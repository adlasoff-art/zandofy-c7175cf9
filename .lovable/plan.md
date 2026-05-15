## Problème

Le déploiement GitHub Actions des edge functions échoue car `https://esm.sh/@supabase/supabase-js@2.45.0` renvoie un **522** (esm.sh CDN momentanément KO). Cela bloque `watermark-image/index.ts`.

D'après nos règles internes (`edge-function-deploy-errors`), il faut **préférer les specifiers `npm:` à esm.sh** pour la stabilité.

## Correction proposée

### 1. `supabase/functions/watermark-image/index.ts`
Remplacer :
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
```
par :
```ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
```
(`deno.land/x/imagescript` reste — c'est un autre CDN, pas affecté par l'incident esm.sh.)

### 2. Miroir `frontend/supabase/functions/watermark-image/index.ts`
Vérifier et appliquer le même remplacement si le fichier existe (cohérence repo, cf. mémoire `watermark-on-upload`).

### 3. Vérification
- Recherche `rg "esm.sh/@supabase" supabase/functions frontend/supabase/functions` pour s'assurer qu'aucune autre fonction n'utilise ce specifier (sinon les corriger en lot).
- Re-déclencher le workflow `deploy-edge-functions.yml`.

## Hors scope
- Pas de changement fonctionnel sur le filigrane.
- Pas de modification du Lot 11B (operator-remind-rider-kyc utilise déjà `npm:`).
- Pas de migration SQL.

## Validation
- GitHub Actions `deploy-edge-functions` doit passer ✅
- Test manuel : upload une image produit → filigrane appliqué.
