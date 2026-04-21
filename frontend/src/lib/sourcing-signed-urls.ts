import { supabase } from "@/integrations/supabase/client";

// In-memory signed URL cache for the `sourcing-images` bucket.
// Signed URLs are valid 1h; we cache 50 min to leave a safety margin.
const TTL_MS = 50 * 60 * 1000;
const cache = new Map<string, { url: string; exp: number }>();
const inflight = new Map<string, Promise<string | null>>();

export async function getSourcingSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;

  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.exp > now) return hit.url;

  const existing = inflight.get(path);
  if (existing) return existing;

  const p = (async () => {
    const { data } = await supabase.storage
      .from("sourcing-images")
      .createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      cache.set(path, { url: data.signedUrl, exp: Date.now() + TTL_MS });
      return data.signedUrl;
    }
    return null;
  })().finally(() => {
    inflight.delete(path);
  });

  inflight.set(path, p);
  return p;
}

export async function getSourcingSignedUrls(paths: string[]): Promise<string[]> {
  const results = await Promise.all(paths.filter(Boolean).map(getSourcingSignedUrl));
  return results.filter((u): u is string => !!u);
}

export async function getSourcingSignedUrlMap(
  paths: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    paths.filter(Boolean).map(async (p) => {
      const u = await getSourcingSignedUrl(p);
      if (u) out[p] = u;
    }),
  );
  return out;
}