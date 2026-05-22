// Contact vendeur via WhatsApp — numéro via Edge Function get-store-whatsapp (auth requis).
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isMobileOrPWA } from "@/lib/device";

const MIN_DIGITS = 8;

export function normalizeWhatsAppDigits(raw: string): string | null {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < MIN_DIGITS) return null;
  return digits;
}

/** wa.me (universal link) + api.whatsapp.com (desktop web fallback). */
export function buildWhatsAppUrls(digits: string, message: string) {
  const text = encodeURIComponent(message);
  return {
    universal: `https://wa.me/${digits}?text=${text}`,
    webSend: `https://api.whatsapp.com/send?phone=${digits}&text=${text}`,
  };
}

async function fetchNumber(storeId: string) {
  return await supabase.functions.invoke<{
    whatsapp_number?: string | null;
    error?: string;
    reason?: string;
  }>("get-store-whatsapp", {
    body: { store_id: storeId },
  });
}

function openWhatsAppUrl(url: string, useSameTab: boolean) {
  if (useSameTab) {
    window.location.assign(url);
    return;
  }
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    toast.message("Ouverture dans cet onglet…", { duration: 2000 });
    window.location.assign(url);
  }
}

export async function openStoreWhatsApp(
  storeId: string,
  message: string,
): Promise<{ ok: boolean; reason?: string }> {
  const useSameTab = isMobileOrPWA();
  const loadingToast = toast.loading("Ouverture de WhatsApp…");

  let res = await fetchNumber(storeId);
  if (res.error && /401|unauth/i.test(String(res.error?.message || ""))) {
    try {
      await supabase.auth.refreshSession();
    } catch {
      /* ignore */
    }
    res = await fetchNumber(storeId);
  }

  toast.dismiss(loadingToast);

  const payload = res.data;
  const error = res.error;

  if (error) {
    toast.error("Impossible de contacter WhatsApp pour le moment. Réessayez.");
    return { ok: false, reason: error.message };
  }

  if (payload?.error === "feature_disabled") {
    toast.error("La messagerie WhatsApp n'est pas activée pour cette boutique.");
    return { ok: false, reason: "feature_disabled" };
  }

  if (payload?.error === "no_number" || !payload?.whatsapp_number) {
    toast.error("Cette boutique n'a pas configuré de numéro WhatsApp.");
    return { ok: false, reason: "no_number" };
  }

  const digits = normalizeWhatsAppDigits(payload.whatsapp_number);
  if (!digits) {
    toast.error("Numéro WhatsApp invalide. Le vendeur doit le mettre à jour.");
    return { ok: false, reason: "invalid_number" };
  }

  const urls = buildWhatsAppUrls(digits, message);
  const targetUrl = useSameTab ? urls.universal : urls.universal;

  openWhatsAppUrl(targetUrl, useSameTab);
  return { ok: true };
}
