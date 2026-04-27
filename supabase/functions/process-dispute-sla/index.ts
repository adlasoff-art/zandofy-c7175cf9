/**
 * process-dispute-sla — Lot 13
 *
 * Cron horaire (configuré via pg_cron) qui appelle la fonction SQL
 * public.process_dispute_sla() pour :
 *  - escalader les litiges sans réponse vendeur après 48h vers admin
 *  - marquer "overdue" les litiges non résolus après 7 jours
 *  - envoyer des notifications SMTP/push aux acteurs concernés
 *
 * Sécurité : utilise SERVICE_ROLE, vérifie un secret partagé Vault
 * (DISPUTE_SLA_CRON_SECRET) au lieu d'un JWT.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get("DISPUTE_SLA_CRON_SECRET");
    const provided = req.headers.get("x-cron-secret");
    if (cronSecret && provided !== cronSecret) {
      return json({ error: "Forbidden" }, 403);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data, error } = await admin.rpc("process_dispute_sla");
    if (error) {
      console.error("[sla] rpc error", error);
      return json({ error: error.message }, 500);
    }

    // Notify newly escalated disputes (best-effort)
    const escalated = (data as any)?.escalated ?? 0;
    const overdue = (data as any)?.overdue ?? 0;

    if (escalated > 0 || overdue > 0) {
      const { data: recent } = await admin
        .from("disputes")
        .select("id, user_id, store_id, escalated_at, is_overdue")
        .or(
          `escalated_at.gte.${new Date(Date.now() - 60 * 60 * 1000).toISOString()},is_overdue.eq.true`,
        )
        .limit(50);

      for (const d of recent || []) {
        await admin.from("notifications").insert({
          user_id: d.user_id,
          type: "dispute_sla",
          title: d.is_overdue ? "Litige en retard" : "Litige escaladé",
          body: d.is_overdue
            ? "Votre litige n'a pas été résolu dans les 7 jours, un administrateur intervient."
            : "Votre litige a été escaladé à un administrateur (pas de réponse du vendeur sous 48h).",
          metadata: { dispute_id: d.id },
        }).catch(() => {});
      }
    }

    return json({ ok: true, ...data });
  } catch (e) {
    console.error("[sla] uncaught", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}