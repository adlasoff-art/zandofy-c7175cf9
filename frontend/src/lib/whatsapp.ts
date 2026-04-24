// Helper: récupère le numéro WhatsApp d'une boutique via l'Edge Function sécurisée
// puis ouvre wa.me dans un nouvel onglet. N'expose le numéro qu'aux utilisateurs connectés.
import { supabase } from "@/integrations/supabase/client";

export async function openStoreWhatsApp(
  storeId: string,
  message: string,
): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await supabase.functions.invoke("get-store-whatsapp", {
    body: { store_id: storeId },
  });
  if (error || !data?.whatsapp_number) {
    return { ok: false, reason: error?.message ?? "no_number" };
  }
  const cleaned = String(data.whatsapp_number).replace(/\D/g, "");
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  return { ok: true };
}
