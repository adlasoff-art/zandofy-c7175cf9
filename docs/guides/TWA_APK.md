# TWA / APK Android (I8)

Distribution v1 = **Trusted Web Activity** around `https://www.zandofy.com` (same PWA).
Not Google Play in this lot — shareable APK via `/get-app`.

## Prerequisites

- Static icons: `frontend/public/icons/icon-192.png`, `icon-512.png`
- Manifest: `frontend/public/manifest.json` (do **not** replace with blob via DynamicFavicon)
- Start URL for TWA: `https://www.zandofy.com/?source=apk`
- Package id: `com.zandofy.app`

## Build (Bubblewrap / PWABuilder)

1. Install Bubblewrap CLI or use [PWABuilder](https://www.pwabuilder.com/).
2. Point at `https://www.zandofy.com` / `manifest.json`.
3. Generate signing keystore **outside the repo** (CI secret / ops vault).
4. Build signed APK.
5. Upload APK to Supabase Storage bucket `cms-assets` (public) e.g. `apk/zandofy.apk`.
6. Set Vercel env `VITE_ANDROID_APK_URL` to the public object URL.
7. Redeploy frontend so `/get-app` shows the download CTA.

## Ops checklist

- [ ] APK opens standalone Chrome Custom Tab / TWA to zandofy.com
- [ ] Digital Asset Links / assetlinks.json if Play / verified domain later
- [ ] `/get-app` reachable from footer / share link
- [ ] Patch releases: bump `version.ts` per SAFETY_POLICY; hard refresh via Admin → PWA broadcast

## Out of scope

Google Play listing (separate epic).
