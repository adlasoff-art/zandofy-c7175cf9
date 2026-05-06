// Helper: récupère le numéro WhatsApp d'une boutique via l'Edge Function sécurisée
// puis ouvre wa.me dans un nouvel onglet. N'expose le numéro qu'aux utilisateurs connectés.
//
// IMPORTANT — fix régression "le clic n'ouvre rien" :
// On ouvre l'onglet IMMÉDIATEMENT (synchrone, pendant le user gesture)
// avec une page d'attente, puis on remplace son URL une fois le numéro reçu.
// Sinon les navigateurs (Safari, Firefox strict, Chrome mobile) bloquent
// le window.open lancé après un await.
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const LOADING_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>WhatsApp…</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;
height:100vh;margin:0;color:#111;background:#f7f7f7}div{text-align:center}</style></head>
<body><div><p>Ouverture de WhatsApp…</p><p style="opacity:.6;font-size:.85em">
Ne fermez pas cet onglet.</p></div></body></html>`;

async function fetchNumber(storeId: string) {
  return await supabase.functions.invoke("get-store-whatsapp", {
    body: { store_id: storeId },
  });
}

export async function openStoreWhatsApp(
  storeId: string,
  message: string,
): Promise<{ ok: boolean; reason?: string }> {
  // 1) Ouvrir l'onglet AVANT tout await pour conserver le user gesture
  const win = typeof window !== "undefined"
    ? window.open("", "_blank", "noopener,noreferrer")
    : null;
  try {
    if (win && !win.closed) {
      win.document.open();
      win.document.write(LOADING_HTML);
      win.document.close();
    }
  } catch {
    /* certains navigateurs interdisent document.write sur about:blank — on ignore */
  }

  // 2) Récupérer le numéro (avec retry si la session est expirée)
  let res = await fetchNumber(storeId);
  if (res.error && /401|unauth/i.test(String(res.error?.message || ""))) {
    try {
      await supabase.auth.refreshSession();
    } catch {
      /* ignore */
    }
    res = await fetchNumber(storeId);
  }

  const data = res.data as { whatsapp_number?: string | null } | null;
  const error = res.error;

  if (error) {
    if (win && !win.closed) win.close();
    toast.error("Impossible de contacter WhatsApp pour le moment. Réessayez.");
    return { ok: false, reason: error.message };
  }
  if (!data?.whatsapp_number) {
    if (win && !win.closed) win.close();
    toast.error("Cette boutique n'a pas configuré de numéro WhatsApp.");
    return { ok: false, reason: "no_number" };
  }

  const cleaned = String(data.whatsapp_number).replace(/\D/g, "");
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;

  // 3) Rediriger l'onglet d'attente, ou fallback si bloqué
  if (win && !win.closed) {
    try {
      win.location.href = url;
    } catch {
      window.location.href = url;
    }
  } else {
    // Pop-up bloqué — fallback : navigation dans l'onglet courant
    window.location.href = url;
  }
  return { ok: true };
}
