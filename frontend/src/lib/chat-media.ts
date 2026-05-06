/**
 * Lot 1.2 — Helper chat-media.
 *
 * Le bucket `chat-media` est PRIVÉ. On ne peut donc pas utiliser
 * `getPublicUrl` (qui renvoie une URL `/object/public/...` vouée à un 404).
 *
 * Convention de stockage dans `messages.content` :
 *   [📷 Image]\nchat-media://<path>
 *   [📄 PDF] <name>\nchat-media://<path>
 *
 * Rétro-compat : si l'URL est absolue (anciens messages écrits en `getPublicUrl`),
 * on tente de la transformer en path puis on signe. Si ce n'est pas une URL
 * chat-media, on la renvoie telle quelle.
 */
import { supabase } from "@/integrations/supabase/client";

const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 jours
const PROTOCOL = "chat-media://";

export function buildChatMediaRef(path: string): string {
  return `${PROTOCOL}${path}`;
}

/** Extrait un path chat-media depuis une référence (`chat-media://...` ou URL legacy). */
export function extractChatMediaPath(ref: string): string | null {
  if (!ref) return null;
  if (ref.startsWith(PROTOCOL)) return ref.slice(PROTOCOL.length);
  // Legacy: URL publique ou signée Supabase
  // .../storage/v1/object/(public|sign)/chat-media/<path>?...
  const m = ref.match(/\/storage\/v1\/object\/(?:public|sign)\/chat-media\/([^?#]+)/);
  if (m && m[1]) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return null;
}

const cache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Résout une référence en URL signée affichable.
 * - `chat-media://path` → URL signée (cachée 6 jours)
 * - URL legacy chat-media → URL signée
 * - autre → renvoyée telle quelle
 */
export async function resolveChatMediaUrl(ref: string): Promise<string> {
  const path = extractChatMediaPath(ref);
  if (!path) return ref;

  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expiresAt > now + 60_000) return cached.url;

  const { data, error } = await supabase.storage
    .from("chat-media")
    .createSignedUrl(path, SIGNED_TTL);

  if (error || !data?.signedUrl) {
    return ref; // fallback : on renvoie la valeur d'origine
  }
  cache.set(path, {
    url: data.signedUrl,
    expiresAt: now + (SIGNED_TTL - 3600) * 1000, // -1h marge
  });
  return data.signedUrl;
}