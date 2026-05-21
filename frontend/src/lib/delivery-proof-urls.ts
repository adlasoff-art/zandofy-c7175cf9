import { supabase } from "@/integrations/supabase/client";

// In-memory signed URL cache for the private `delivery-proofs` bucket.
// Signed URLs valid 24h ; on cache 23h pour marge de sécurité.
const TTL_SECONDS = 24 * 60 * 60;
const CACHE_TTL_MS = 23 * 60 * 60 * 1000;
const cache = new Map<string, { url: string; exp: number }>();
const inflight = new Map<string, Promise<string | null>>();

/**
 * Récupère une URL signée 24h pour un objet du bucket privé `delivery-proofs`.
 * Accepte soit un chemin de stockage, soit une URL HTTP déjà signée/publique
 * (cas legacy : on retourne tel quel).
 */
export async function getDeliveryProofUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http")) return pathOrUrl;

  const now = Date.now();
  const hit = cache.get(pathOrUrl);
  if (hit && hit.exp > now) return hit.url;

  const existing = inflight.get(pathOrUrl);
  if (existing) return existing;

  const p = (async () => {
    const { data } = await supabase.storage
      .from("delivery-proofs")
      .createSignedUrl(pathOrUrl, TTL_SECONDS);
    if (data?.signedUrl) {
      cache.set(pathOrUrl, { url: data.signedUrl, exp: Date.now() + CACHE_TTL_MS });
      return data.signedUrl;
    }
    return null;
  })().finally(() => {
    inflight.delete(pathOrUrl);
  });

  inflight.set(pathOrUrl, p);
  return p;
}

/**
 * Extrait le chemin de stockage à partir d'une URL publique Supabase legacy.
 * Si l'entrée n'est pas une URL publique reconnue, retourne tel quel.
 */
export function extractDeliveryProofPath(urlOrPath: string): string {
  const marker = "/storage/v1/object/public/delivery-proofs/";
  const idx = urlOrPath.indexOf(marker);
  if (idx >= 0) return urlOrPath.substring(idx + marker.length);
  return urlOrPath;
}