

L'utilisateur a accédé à l'admin Automations et voit "Workflows (0) — Aucun workflow créé". C'est inattendu : la mémoire dit que 13 workflows pré-remplis existent (J0→J30), mais la liste est vide en prod.

Hypothèses :
1. Les 13 workflows ont été insérés en staging (`wgi...ete`) mais pas en prod (`vpt...yxf`)
2. La migration de seed n'a jamais été appliquée en prod
3. C'est cohérent avec le pattern récurrent : staging ≠ prod

Plan : seeder les 13 workflows en prod via une migration SQL idempotente, puis l'utilisateur active ceux qu'il veut.

## Situation actuelle

Tu vois "Workflows (0)" parce que **les 13 workflows pré-remplis n'ont jamais été insérés en base de données prod** (`vpt...yxf`). Ils existent probablement en staging, mais la migration de seed n'a pas été appliquée en prod.

Tu as 2 options pour avancer :

### Option A — Créer manuellement tes workflows depuis l'écran (5 min)

Le formulaire "+ Nouveau workflow" que tu vois marche déjà. Tu peux créer 1 ou 2 workflows simples maintenant pour tes 50 nouveaux clients :

**Exemple workflow "Bienvenue J0" :**
- Nom : `Bienvenue J0`
- Déclencheur : `Visite sans compte` (ou `Compte créé` selon ta cible)
- Canal : `Popup`
- Délai jours : `0`
- Fréquence : `Une seule fois`
- Conditions : laisse "Indifférent"
- Titre : `Bienvenue chez Zandofy !`
- Contenu : `Découvrez notre sélection sino-africaine...`
- Lien CTA : `/products`
- Libellé CTA : `Découvrir`
- Active le toggle après création

Avantage : 0 dev, immédiat. Inconvénient : tu dois recréer les 13 manuellement.

### Option B — Seeder les 13 workflows pré-définis en prod (recommandé)

Je crée une migration SQL avec les 13 workflows J0→J30 pré-remplis (Bienvenue, Découverte, Premier achat, Relances J3/J7/J14/J21/J30, etc.). La migration utilise `INSERT ... ON CONFLICT DO NOTHING` pour être 100% idempotente — aucun risque même si tu as déjà créé des workflows manuellement.

**Étapes :**
1. Je crée `frontend/supabase/migrations/<timestamp>_seed_automation_workflows.sql` avec les 13 INSERTs
2. Tu pushes via GitHub Actions → migration appliquée en prod
3. Tu rafraîchis `/admin/popups` → tu vois les 13 workflows
4. Tu actives ceux que tu veux pour tes 50 clients
5. Tous les workflows restent **inactifs par défaut** (sécurité)

**Contenu des 13 workflows seedés** (titre + canal + délai) :
- J0 — Bienvenue après visite (popup, 0j)
- J0 — Bienvenue après inscription (email, 0j)
- J1 — Découverte catalogue (push, 1j)
- J3 — Premier achat avec code promo (popup+email, 3j)
- J5 — Relance produits vus (push, 5j)
- J7 — Pas encore commandé (email, 7j)
- J10 — Témoignages clients (popup, 10j)
- J14 — Relance forte avec offre (email+push, 14j)
- J18 — Quartier livré (push, 18j)
- J21 — Dernière chance offre (email, 21j)
- J25 — Sondage motivations (popup, 25j)
- J30 — Désabonnement soft (email, 30j)
- Trigger événementiel — Compte créé sans 1ère commande après 7j (email)

Le contenu textuel (titre, message, image, CTA) sera générique en français — tu pourras éditer chaque workflow depuis l'écran admin avant activation.

### Ce que je NE ferai pas

- Aucun changement code frontend (l'écran admin marche déjà)
- Aucune modification de l'edge function `process-automation-workflows` (déjà déployée)
- Aucune activation automatique — tous les workflows resteront `is_active = false`

### Décision attendue

- **A** : tu crées manuellement 1-2 workflows maintenant (rapide, mais limité)
- **B** : je seed les 13 workflows en prod via migration (recommandé, complet)
- **A+B** : tu commences avec 1 workflow manuel pour tes 50 clients pendant que je prépare le seed des 13

Dis-moi A, B ou A+B.

