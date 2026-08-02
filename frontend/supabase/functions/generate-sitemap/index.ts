/**
 * LEGACY — do not deploy.
 * Source of truth: supabase/functions/generate-sitemap/index.ts (repo root).
 * This copy remains only to avoid broken imports in old tooling; it mirrors www canonical.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_URL = "https://www.zandofy.com";

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

Deno.serve(async () => {
  return new Response(
    JSON.stringify({
      error: "Deprecated. Deploy supabase/functions/generate-sitemap from repo root.",
      site: SITE_URL,
      slugifySample: slugify("Mode"),
    }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  );
});
