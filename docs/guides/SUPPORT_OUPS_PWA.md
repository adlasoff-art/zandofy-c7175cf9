# Support — écran « Oups »

Si un client voit **Oups ! Un problème est survenu** :

1. Lui demander de toucher **Recharger la page** (vide déjà les caches).
2. Si ça revient : fermer l’app PWA, rouvrir ; ou Chrome → Paramètres du site → **Effacer données** / désinstaller-réinstaller l’icône.
3. Après un déploiement : Admin → Notifications → **Mise à jour PWA** (diffuser la version courante dans `version.ts`).

Cause fréquente corrigée en v1.12 : navigation checkout ↔ home + chunks PWA périmés.
