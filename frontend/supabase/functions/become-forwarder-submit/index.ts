/**
 * become-forwarder-submit — Phase 10
 *
 * Demande publique pour devenir transitaire (KYB).
 * - Auth requise (utilisateur connecté).
 * - Anti-doublon (1 demande active par user).
 * - Crée la ligne dans `forwarders` avec status='pending'.
 * - Donne le rôle 'forwarder' au user.
 * - Notifie les admins (in-app, best-effort).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RouteSchema = z.object({
  origin_country: z.string().length(2),
  origin_city: z.string().trim().min(1).max(80),
  destination_country: z.string().length(2),
  destination_city: z.string().trim().min(1).max(80),
});

const DocSchema = z.object({
  type: z.enum(["registre_commerce", "agrement", "tva", "rib", "autre"]),
  storage_path: z.string().min(1),
  filename: z.string().min(1),
});

const BodySchema = z.object({
  company_name: z.string().trim().min(2).max(120),
  legal_name: z.string().trim().max(160).optional().nullable(),
  registration_number: z.string().trim().max(60).optional().nullable(),
  tax_id: z.string().trim().max(60).optional().nullable(),
  contact_email: z.string().trim().email().max(160),
  contact_phone: z.string().trim().min(6).max(40),
  headquarters_country: z.string().length(2),
  headquarters_city: z.string().trim().min(1).max(80),
  headquarters_address: z.string().trim().max(255).optional().nullable(),
  supported_modes: z.array(z.enum(["air", "sea", "road", "rail"])).min(1),
  coverage_routes: z.array(RouteSchema).min(1).max(50),
  estimated_monthly_volume_kg: z.number().min(0).optional().nullable(),
  documents: z.array(DocSchema).min(1).max(10),
  description: z.string().trim().max(1000).optional().nullable(),
  website_url: z.string().trim().url().max(255).optional().nullable(),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "transitaire";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
    }
    const body = parsed.data;

    const svc = createClient(supabaseUrl, serviceKey);

    // Anti-doublon
    const { data: existing } = await svc
      .from("forwarders")
      .select("id, status")
      .eq("owner_user_id", userId)
      .in("status", ["pending", "approved", "suspended"])
      .maybeSingle();
    if (existing) {
      return json(
        {
          error: "Vous avez déjà une demande transitaire en cours ou un dossier actif.",
          existing_status: existing.status,
        },
        409,
      );
    }

    // Slug unique
    const baseSlug = slugify(body.company_name);
    let slug = baseSlug;
    let attempt = 0;
    while (attempt < 5) {
      const { data: dup } = await svc.from("forwarders").select("id").eq("slug", slug).maybeSingle();
      if (!dup) break;
      attempt += 1;
      slug = `${baseSlug}-${Math.floor(Math.random() * 10000)}`;
    }

    const { data: fw, error: fwErr } = await svc
      .from("forwarders")
      .insert({
        slug,
        name: body.company_name,
        legal_name: body.legal_name ?? null,
        registration_number: body.registration_number ?? null,
        tax_id: body.tax_id ?? null,
        contact_email: body.contact_email,
        contact_phone: body.contact_phone,
        headquarters_country: body.headquarters_country,
        headquarters_city: body.headquarters_city,
        headquarters_address: body.headquarters_address ?? null,
        supported_modes: body.supported_modes,
        coverage_routes: body.coverage_routes,
        estimated_monthly_volume_kg: body.estimated_monthly_volume_kg ?? null,
        description: body.description ?? null,
        website_url: body.website_url ?? null,
        documents: body.documents,
        status: "pending",
        is_active: false,
        owner_user_id: userId,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (fwErr || !fw) {
      console.error("[become-forwarder-submit] insert failed", fwErr);
      return json({ error: "Création dossier transitaire échouée", details: fwErr?.message }, 500);
    }

    // Rôle forwarder
    await svc
      .from("user_roles")
      .upsert({ user_id: userId, role: "forwarder" }, { onConflict: "user_id,role" });

    // Notif admins (best-effort)
    try {
      const { data: admins } = await svc
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (admins?.length) {
        await svc.from("notifications").insert(
          admins.map((a: any) => ({
            user_id: a.user_id,
            type: "info",
            title: "Nouvelle demande de transitaire",
            message: `${body.company_name} a soumis une demande pour devenir transitaire.`,
            link: "/admin/forwarders",
          })),
        );
      }
    } catch (e) {
      console.warn("[become-forwarder-submit] notif admins failed", e);
    }

    return json({ success: true, forwarder_id: fw.id, status: "pending" }, 200);
  } catch (e: unknown) {
    console.error("[become-forwarder-submit] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}