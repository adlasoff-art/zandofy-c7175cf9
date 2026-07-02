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

  // FunctionsHttpError — try context.json() (recent supabase-js)
  if (error.context && typeof error.context.json === "function") {
    try {
      const json = await error.context.json();
      if (json?.error) return json.error;
      if (json?.message) return json.message;
    } catch {
      // fall through
    }
  }

  // FunctionsHttpError — try to parse the response body stream
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
 * Throw if an edge function invoke returned an error (checks data.error first).
 */
export async function throwIfEdgeFunctionError(res: { data: any; error: any }): Promise<void> {
  if (res.data?.error) throw new Error(res.data.error);
  if (res.error) throw new Error(await parseEdgeFunctionError(res.error));
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
