

## Problème identifié

Le build réussit mais le dossier de sortie `dist/` n'est pas trouvé à la racine du projet. C'est parce que `vite.config.ts` définit `root: "frontend"`, donc Vite génère le build dans `frontend/dist/` au lieu de `dist/`.

## Correction

Ajouter `build.outDir` dans le `vite.config.ts` racine pour rediriger la sortie vers `../dist` (la racine du projet) :

```ts
// vite.config.ts (racine)
build: {
  outDir: "../dist",
}
```

C'est une modification d'une seule ligne. Aucun autre fichier à modifier.

