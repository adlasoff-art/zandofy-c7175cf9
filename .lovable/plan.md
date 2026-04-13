

# QR Code : design moderne + lien fixe vers zandofy.com

## Changements

### 1. Remplacer `qrcode.react` par `react-qrcode-logo`

La librairie `qrcode.react` (QRCodeSVG) ne supporte pas les coins arrondis sur les "finder patterns" (les 3 grands carres). La librairie `react-qrcode-logo` offre nativement :
- `qrStyle="dots"` — modules ronds au lieu de carres
- `eyeRadius` — bords arrondis sur les 3 finder patterns
- Logo au centre avec excavation

### 2. Modifier `FloatingActions.tsx`

- Installer `react-qrcode-logo`
- Remplacer `QRCodeSVG` par `QRCode` de `react-qrcode-logo`
- Fixer la valeur du QR code a `https://zandofy.com` (au lieu de `window.location.origin`)
- Appliquer le style moderne : dots ronds, coins arrondis, logo central

```tsx
import { QRCode } from "react-qrcode-logo";

<QRCode
  value="https://zandofy.com"
  size={140}
  qrStyle="dots"
  eyeRadius={12}
  logoImage="/favicon.ico"
  logoWidth={28}
  logoHeight={28}
  removeQrCodeBehindLogo
  ecLevel="M"
/>
```

### 3. Desinstaller `qrcode.react`

Retirer l'ancienne dependance du `package.json`.

## Fichiers modifies

- `frontend/src/components/FloatingActions.tsx`
- `package.json` (ajout `react-qrcode-logo`, retrait `qrcode.react`)

