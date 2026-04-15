
# Chat instantané + image/lien + champ plus confortable

## Objectif
Corriger le chat sans casser le flux actuel, pour que pendant une discussion active :
1. les messages envoyés s’affichent tout de suite,
2. le client puisse envoyer une image plus facilement,
3. le client puisse partager un lien proprement,
4. le champ de saisie soit plus haut et plus pratique sur mobile/PWA et desktop.

## Portée validée
Vous avez confirmé : **les deux chats**
- `frontend/src/components/InternalChat.tsx`
- `frontend/src/components/messages/ChatPanel.tsx`

## Ce que je vais implémenter

### 1. Affichage immédiat des messages
Je garde l’architecture actuelle, mais j’ajoute un affichage local immédiat après insert réussi :
- texte,
- image,
- PDF.

Cela évite d’attendre le polling ou le retour du flux avant de voir son propre message.

### 2. Import image plus simple
Dans les deux chats :
- conserver l’upload existant,
- ajouter une UX plus claire pour **importer une image**,
- prendre en charge le **coller d’image depuis le presse-papiers** quand c’est possible,
- sur mobile, prévoir aussi l’entrée caméra si le composant le permet proprement.

Je réutilise le format de message actuel (`[📷 Image] ...`) pour ne rien casser côté stockage/lecture.

### 3. Partage de lien réellement exploitable
Aujourd’hui un lien peut être tapé, mais il n’est pas rendu proprement dans les messages.
Je vais :
- permettre l’ajout d’un lien de façon claire dans l’UI,
- rendre les URL **cliquables** dans les bulles de messages,
- respecter les réglages existants de la boutique (`chat_links_allowed`) quand ils existent.

Pour `InternalChat`, je vais aligner le comportement avec `ChatPanel` en chargeant aussi le paramètre de liens.

### 4. Champ de saisie plus grand
Je remplace le champ mono-ligne perçu par un vrai composeur plus confortable :
- hauteur minimale de **2 à 3 lignes**,
- auto-resize jusqu’à une limite raisonnable,
- `Entrée` pour envoyer,
- `Shift+Entrée` pour aller à la ligne,
- meilleur confort sur mobile/PWA.

### 5. Réduction du retard visible dans le chat boutique
Pour `InternalChat`, en plus de l’optimistic update :
- rafraîchissement plus réactif quand le chat est actif,
- refresh immédiat après envoi,
- logique de récupération des nouveaux messages seulement, pour éviter les rechargements lourds.

## Fichiers concernés
- `frontend/src/components/InternalChat.tsx`
- `frontend/src/components/messages/ChatPanel.tsx`
- éventuellement un petit helper partagé si nécessaire pour éviter de dupliquer la logique de rendu lien/image

## Détails techniques
- **Aucune migration SQL**
- **Aucun changement de schéma**
- **Aucune règle RLS à modifier**
- conservation du stockage actuel des médias
- conservation du format actuel des messages image/PDF
- rendu des liens amélioré côté frontend uniquement
- nouveaux labels/toasts à brancher sur le système d’i18n existant

## Résultat attendu
- vos messages apparaissent immédiatement,
- le client peut envoyer une image plus facilement,
- un lien partagé devient cliquable et lisible,
- le champ de message devient beaucoup plus pratique pendant une vraie conversation active,
- tout cela sans changer la base ni casser les discussions en cours.
