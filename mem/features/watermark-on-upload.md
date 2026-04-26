---
name: Watermark on upload
description: Filigrane logo Zandofy incrusté à l'upload via edge function watermark-image. 1 seule version stockée.
type: feature
---

Système de filigrane automatique sur les images produits (Lot 10 — Volet C).

**Architecture** :
1. `MediaUploader.tsx` upload l'image dans `product-media`, puis appelle `supabase.functions.invoke("watermark-image", { body: { bucket, path } })` (best-effort, non-bloquant).
2. Edge function `watermark-image` (verify_jwt=false) lit `platform_settings.watermark_config`. Si `enabled=true` + `logo_url` présent, télécharge l'image, télécharge le logo, compose via `imagescript` (deno.land/x/imagescript@1.2.17), ré-upload avec `upsert: true` → écrase l'original.
3. Admin : `SeoWatermarkSection` (intégrée dans `AdminSEOPage`) — toggle, upload logo dans bucket `seo-assets`, position (4 coins + centre), opacité (10-100%), taille (5-30% largeur).

**Config par défaut** (clé `platform_settings.watermark_config`) :
```json
{ "enabled": false, "logo_url": "", "position": "bottom-right", "opacity": 0.5, "size_ratio": 0.12, "margin_ratio": 0.02 }
```

**Limites** :
- N'agit QUE sur les nouveaux uploads (pas le backlog existant).
- Vidéos ignorées (skip côté MediaUploader).
- SVG/GIF ignorés côté edge function (skipped reason).
- Irréversible : pas de copie originale conservée. Pour retirer le filigrane, le vendeur doit ré-uploader.
- PNG transparent en entrée → PNG en sortie. JPEG → JPEG qualité 85.

**Edge function** : déployée à la racine `supabase/functions/watermark-image/` (la racine GitHub→Vercel→Supabase prod). Une copie miroir dans `frontend/supabase/functions/` pour cohérence repo.
