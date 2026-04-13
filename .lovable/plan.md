

# Transcription audio MP3

## Approche

1. Copier le fichier `user-uploads://0413.MP3` vers `/tmp/0413.mp3`
2. Utiliser le script Lovable AI avec le modèle **google/gemini-2.5-flash** (qui supporte l'audio/multimodal) pour transcrire le contenu
3. Envoyer l'audio encodé en base64 au modèle avec une instruction de transcription français/lingala
4. Sauvegarder le texte transcrit dans `/mnt/documents/transcription.txt`

## Détail technique

- Le modèle Gemini 2.5 Flash supporte les entrées multimodales (audio inclus)
- L'instruction demandera de transcrire fidèlement tout ce qui est dit, en gardant les mots français et lingala tels quels
- Le résultat sera un fichier texte téléchargeable

## Fichiers produits

- `/mnt/documents/transcription.txt` — le texte transcrit

Aucune modification du projet Zandofy n'est nécessaire.

