/**
 * Vercel Root Directory = repo root (vite root: frontend → dist/).
 * Edge Functions must live at /api (repo root), not frontend/api.
 * Keep frontend/api as edit source; sync before build.
 */
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "..", "api");
const destDir = join(__dirname, "..", "..", "api");

mkdirSync(destDir, { recursive: true });
const files = readdirSync(srcDir).filter((f) => f.endsWith(".ts"));
for (const f of files) {
  copyFileSync(join(srcDir, f), join(destDir, f));
  console.log("[sync-vercel-api]", f, "→ /api/");
}
console.log("[sync-vercel-api] synced", files.length, "files");
