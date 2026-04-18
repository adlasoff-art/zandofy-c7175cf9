

## 🎯 Cause racine identifiée — c'est CORS, pas un bug applicatif

Les logs console que tu viens de coller révèlent **la vraie cause** du problème "Aucune commande trouvée" (et de plein d'autres bugs latents en prod) :

```
Access to fetch at 'https://vpttoqojmiqxgudknyxf.supabase.co/functions/v1/platform-bootstrap' 
from origin 'https://zandofy.com' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

### Ce que ça signifie concrètement

1. Le navigateur, avant tout appel `POST` vers une edge function, envoie une requête `OPTIONS` (preflight CORS).
2. Cette requête `OPTIONS` arrive sur l'edge function `platform-bootstrap` (et probablement aussi `generate-shipping-labels`) en prod.
3. **L'edge function ne répond PAS correctement au preflight** → elle renvoie un statut non-2xx (probablement 401 ou 500), ce qui fait que le navigateur **bloque** l'appel `POST` réel avant même qu'il parte.
4. Côté frontend, on ne voit qu'une erreur générique → on retombe sur le toast "Aucune commande trouvée" qui est en réalité un fallback d'erreur réseau silencieuse.

### Pourquoi c'est arrivé

Tes edge functions en prod (`vpt...yxf`) ont probablement **un de ces 3 problèmes** :
- **A.** Pas de handler `if (req.method === 'OPTIONS')` qui retourne `200` avec les headers CORS
- **B.** `verify_jwt = true` dans `config.toml` → le preflight `OPTIONS` (qui n'a JAMAIS de header `Authorization`) est rejeté avec 401 par le runtime Supabase **avant** d'atteindre ton code
- **C.** Header `Access-Control-Allow-Origin` mal configuré (ex: ne contient pas `https://zandofy.com`)

### Bonus : 2 autres erreurs visibles dans la console

- `automation_workflows ... 404` → la table existe en Lovable Cloud mais **pas en prod Supabase** → migration manquante
- `Cloudflare Insights bloqué par CSP` → bénin, ignorable
- `X-Frame-Options via <meta>` → bénin, juste un avertissement HTML

---

## 🛠️ Plan d'action — corriger CORS sur toutes les edge functions critiques en prod

### Étape 1 — Audit lecture (immédiat, en mode plan)

Je vais lire les fichiers suivants dans le repo pour cartographier l'état actuel :

1. `frontend/supabase/functions/platform-bootstrap/index.ts` → vérifier handler OPTIONS + headers CORS
2. `frontend/supabase/functions/generate-shipping-labels/index.ts` → idem
3. `frontend/supabase/config.toml` → vérifier `verify_jwt` pour ces 2 fonctions

### Étape 2 — Correctif standardisé (en mode default, après ton OK)

Pour **chaque** edge function publique appelée depuis `zandofy.com`, appliquer ce pattern verrouillé :

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",  // ou Deno.env.get("ALLOWED_ORIGIN") || "https://zandofy.com"
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  // ⚠️ TOUJOURS en premier, avant toute logique
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  // ... reste du code ...
  
  // Toutes les réponses doivent inclure corsHeaders
  return new Response(JSON.stringify({ ok: true, ... }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

Et dans `frontend/supabase/config.toml` :
```toml
[functions.platform-bootstrap]
verify_jwt = false

[functions.generate-shipping-labels]
verify_jwt = false  # le JWT est validé manuellement dans le code via getUser()
```

### Étape 3 — Push vers GitHub → déploiement auto sur Supabase prod (`vpt...yxf`)

Comme on est sur la stack `Lovable → GitHub → Vercel/Supabase prod`, le commit déclenchera le redéploiement automatique des edge functions vers ta prod via GitHub Actions.

### Étape 4 — Validation

Tu retesteras "Imprimer étiquette" sur `zandofy.com`. Cette fois la requête preflight passera, l'edge function répondra correctement, et tu verras soit :
- ✅ Le PDF généré → problème résolu
- ❌ Une nouvelle erreur **précise** (avec `errorCode` lisible) → on saura quoi corriger ensuite

### Étape 5 (séparée, optionnelle) — Migration `automation_workflows` manquante en prod

Le 404 sur `automation_workflows` indique que cette table existe en Lovable Cloud mais pas dans ta DB prod. À traiter dans un second temps si tu utilises cette feature.

---

## ⚠️ Ce que je ne ferai PAS

- Aucun changement à `client.ts`, `.env`, `types.ts`
- Aucune migration DB (sauf si tu valides séparément l'étape 5)
- Aucun déploiement direct vers prod (tout passe par GitHub)
- Aucun changement sur Lovable Cloud (ce n'est pas la source de vérité)

## ✅ Décision attendue

**Confirme** et je passe en exécution :
1. Lecture des 2 edge functions + `config.toml`
2. Application du pattern CORS verrouillé + `verify_jwt = false`
3. Commit → GitHub → déploiement auto sur Supabase prod
4. Tu retestes et on confirme la résolution

