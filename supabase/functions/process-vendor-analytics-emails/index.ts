import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Schedule {
  id: string;
  store_id: string;
  recipient_email: string;
  frequency: "weekly" | "monthly";
  format: "csv" | "pdf";
  day_of_week: number | null;
  day_of_month: number | null;
  enabled: boolean;
  last_sent_at: string | null;
}

function isDue(s: Schedule, now: Date): boolean {
  if (!s.enabled) return false;
  if (s.last_sent_at) {
    const last = new Date(s.last_sent_at);
    const minHours = s.frequency === "weekly" ? 24 * 6 : 24 * 27;
    if ((now.getTime() - last.getTime()) / 3.6e6 < minHours) return false;
  }
  if (s.frequency === "weekly" && s.day_of_week != null && now.getUTCDay() !== s.day_of_week) return false;
  if (s.frequency === "monthly" && s.day_of_month != null && now.getUTCDate() !== s.day_of_month) return false;
  return true;
}

function buildCSV(rows: any[]): string {
  if (!rows.length) return "Aucune donnée";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
}

function buildHTML(storeName: string, kpis: any, top: any[], periodLabel: string): string {
  const fmt = (n: number) => `$${Math.round(n || 0).toLocaleString("fr-FR")}`;
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto">
    <h2>Rapport Analytics — ${storeName}</h2>
    <p style="color:#666">Période : ${periodLabel}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px;border:1px solid #eee"><b>Chiffre d'affaires</b></td><td style="padding:8px;border:1px solid #eee">${fmt(kpis?.revenue)}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee"><b>Commandes</b></td><td style="padding:8px;border:1px solid #eee">${kpis?.orders || 0}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee"><b>Panier moyen</b></td><td style="padding:8px;border:1px solid #eee">${fmt(kpis?.aov)}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee"><b>Marge brute</b></td><td style="padding:8px;border:1px solid #eee">${fmt(kpis?.gross_margin)} (${kpis?.margin_pct || 0}%)</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee"><b>Clients uniques</b></td><td style="padding:8px;border:1px solid #eee">${kpis?.unique_customers || 0}</td></tr>
    </table>
    <h3>Top 10 produits</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f5f5f5"><th style="padding:6px;text-align:left">Produit</th><th style="padding:6px">Unités</th><th style="padding:6px">CA</th></tr></thead>
      <tbody>${top.slice(0, 10).map(t => `<tr><td style="padding:6px;border-top:1px solid #eee">${t.product_name}</td><td style="padding:6px;border-top:1px solid #eee;text-align:center">${t.units_sold}</td><td style="padding:6px;border-top:1px solid #eee;text-align:right">${fmt(t.revenue)}</td></tr>`).join("")}</tbody>
    </table>
    <p style="color:#999;font-size:12px;margin-top:24px">Rapport automatique Zandofy · vous pouvez désactiver l'envoi depuis votre dashboard vendeur.</p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const { data: schedules, error } = await admin
      .from("vendor_analytics_email_schedules")
      .select("*")
      .eq("enabled", true);
    if (error) throw error;

    const now = new Date();
    let processed = 0, sent = 0, failed = 0;

    for (const s of (schedules || []) as Schedule[]) {
      processed++;
      if (!isDue(s, now)) continue;

      const periodDays = s.frequency === "weekly" ? 7 : 30;
      const start = new Date(now); start.setDate(start.getDate() - periodDays);

      try {
        const { data: store } = await admin.from("stores").select("name").eq("id", s.store_id).single();

        const [kpisRes, topRes, exportRes] = await Promise.all([
          admin.rpc("vendor_analytics_kpis", { p_store_id: s.store_id, p_start: start.toISOString(), p_end: now.toISOString() }),
          admin.rpc("vendor_analytics_top_products", { p_store_id: s.store_id, p_start: start.toISOString(), p_end: now.toISOString(), p_limit: 10 }),
          s.format === "csv" ? admin.rpc("vendor_analytics_orders_export", { p_store_id: s.store_id, p_start: start.toISOString(), p_end: now.toISOString() }) : Promise.resolve({ data: null }),
        ]);

        const kpis = (kpisRes.data as any)?.current || {};
        const top = (topRes.data as any[]) || [];
        const periodLabel = `${start.toLocaleDateString("fr-FR")} → ${now.toLocaleDateString("fr-FR")}`;
        const subject = `Rapport ${s.frequency === "weekly" ? "hebdomadaire" : "mensuel"} — ${store?.name || "votre boutique"}`;
        const html = buildHTML(store?.name || "Boutique", kpis, top, periodLabel);

        const attachments: any[] = [];
        if (s.format === "csv" && exportRes.data) {
          const csv = buildCSV(exportRes.data as any[]);
          attachments.push({
            filename: `commandes-${periodDays}j.csv`,
            content: btoa(unescape(encodeURIComponent(csv))),
            type: "text/csv",
          });
        }

        // Délègue à send-vendor-email (déjà configuré avec SMTP Hostinger)
        const sendRes = await admin.functions.invoke("send-vendor-email", {
          body: {
            to: s.recipient_email,
            subject,
            html,
            attachments,
          },
        });

        if (sendRes.error) throw sendRes.error;

        await admin
          .from("vendor_analytics_email_schedules")
          .update({ last_sent_at: now.toISOString() })
          .eq("id", s.id);
        sent++;
      } catch (err) {
        console.error(`Schedule ${s.id} failed:`, err);
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("process-vendor-analytics-emails error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});