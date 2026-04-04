import { supabase } from "@/integrations/supabase/client";

/**
 * Ensures the admin session is fresh before making sensitive API calls.
 * Refreshes the JWT if it's expired or expiring within 60 seconds.
 */
export async function ensureFreshSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Session expirée. Veuillez vous reconnecter.");

  const expiresAt = session.expires_at ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);

  if (expiresAt - nowSec < 60) {
    const { error } = await supabase.auth.refreshSession();
    if (error) throw new Error("Impossible de rafraîchir la session. Reconnectez-vous.");
  }
}

/**
 * Parse edge function error into a user-friendly message.
 */
export async function parseEdgeFunctionError(error: any): Promise<string> {
  if (!error) return "Erreur inconnue";

  // FunctionsHttpError — try to parse the response body
  if (error.context?.body) {
    try {
      const reader = error.context.body.getReader();
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      const json = JSON.parse(text);
      return json.error || json.message || text;
    } catch {
      // fall through
    }
  }

  if (error.message?.includes("non-2xx")) {
    return "La fonction serveur a retourné une erreur. Vérifiez votre connexion et réessayez.";
  }

  return error.message || "Erreur inconnue";
}

/**
 * Send an email via the send-email edge function with session refresh.
 */
export async function sendAdminEmail(payload: { to: string; subject: string; html: string }) {
  await ensureFreshSession();

  const { data, error } = await supabase.functions.invoke("send-email", {
    body: payload,
  });

  if (error) {
    const msg = await parseEdgeFunctionError(error);
    throw new Error(msg);
  }

  if (data?.error) throw new Error(data.error);
  return data;
}
