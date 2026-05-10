import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin/manager role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isStaff = (roles ?? []).some(
      (r: any) => r.role === "admin" || r.role === "manager",
    );
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.request_id ?? "");
    if (!requestId) {
      return new Response(JSON.stringify({ error: "request_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: request, error: reqErr } = await supabase
      .from("product_sourcing_requests")
      .select("id, user_id, product_name, product_sourcing_responses(*)")
      .eq("id", requestId)
      .maybeSingle();
    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = (request as any).product_sourcing_responses;
    if (!response) {
      return new Response(JSON.stringify({ error: "No response yet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, first_name")
      .eq("id", request.user_id)
      .maybeSingle();

    const recipientEmail = profile?.email;
    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: "No client email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productName = escapeHtml(response.product_name || request.product_name || "Votre produit");
    const description = escapeHtml(response.description || "");
    const price = response.price ?? 0;
    const currency = escapeHtml(response.currency || "USD");
    const moq = response.min_quantity ?? 1;
    const colors: string[] = Array.isArray(response.colors) ? response.colors : [];
    const imageUrl = response.image_url ? escapeHtml(response.image_url) : null;
    const greeting = profile?.first_name ? `Bonjour ${escapeHtml(profile.first_name)},` : "Bonjour,";

    const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#ffffff;color:#111;padding:24px">
  <div style="max-width:560px;margin:0 auto">
    <h2 style="color:#0f9d58">Nous avons trouvé votre produit !</h2>
    <p>${greeting}</p>
    <p>Suite à votre demande, voici les informations sur le produit que nous avons identifié pour vous :</p>
    ${imageUrl ? `<img src="${imageUrl}" alt="${productName}" style="max-width:100%;border-radius:8px;margin:12px 0" />` : ""}
    <h3 style="margin:16px 0 8px">${productName}</h3>
    ${description ? `<p style="color:#555">${description}</p>` : ""}
    <table style="width:100%;border-collapse:collapse;margin-top:12px">
      <tr><td style="padding:6px 0;color:#666">Prix</td><td style="padding:6px 0;text-align:right"><strong>${price} ${currency}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#666">Quantité minimum</td><td style="padding:6px 0;text-align:right">${moq}</td></tr>
      ${colors.length ? `<tr><td style="padding:6px 0;color:#666">Couleurs</td><td style="padding:6px 0;text-align:right">${colors.map(escapeHtml).join(", ")}</td></tr>` : ""}
    </table>
    <p style="margin-top:24px">Connectez-vous à votre espace pour voir tous les détails et nous contacter pour passer commande.</p>
    <p style="color:#999;font-size:12px;margin-top:32px">— L'équipe Zandofy</p>
  </div>
</body></html>`;

    await sendEmail({      to: recipientEmail,
      subject: `Votre produit demandé est disponible — ${productName}`,
      html,
    });

    await supabase
      .from("product_sourcing_responses")
      .update({ notify_email_sent: true })
      .eq("request_id", requestId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-sourcing-response error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});