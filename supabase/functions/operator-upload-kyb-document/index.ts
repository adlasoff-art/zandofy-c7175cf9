/**
 * operator-upload-kyb-document — Lot final consolidation
 *
 * Owner d'un opérateur uploade un document KYB (RCCM, NIF, etc.).
 * Le fichier est déjà uploadé dans le bucket privé `operator-kyb-documents`
 * via le SDK côté client (RLS storage protège). Cette fonction enregistre
 * uniquement la ligne metadata + valide MIME/taille + idempotence.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const BodySchema = z.object({
  operator_id: z.string().uuid(),
  doc_type: z.enum(["rccm", "nif", "id_card", "business_license", "insurance", "tax_clearance", "other"]),
  file_path: z.string().min(1),     // <operator_id>/<doc_type>/<filename>
  file_name: z.string().min(1).max(255),
  mime_type: z.string().min(1),
  size_bytes: z.number().int().positive(),
});

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
    const input = parsed.data;

    if (!ALLOWED_MIME.has(input.mime_type)) {
      return json({ error: `Type de fichier non autorisé : ${input.mime_type}. Autorisés : PDF, JPG, PNG, WEBP.` }, 400);
    }
    if (input.size_bytes > MAX_SIZE) {
      return json({ error: `Fichier trop volumineux (max ${MAX_SIZE / 1024 / 1024} Mo).` }, 400);
    }
    // Convention : le path doit commencer par <operator_id>/<doc_type>/
    const expectedPrefix = `${input.operator_id}/${input.doc_type}/`;
    if (!input.file_path.startsWith(expectedPrefix)) {
      return json({ error: `file_path doit commencer par ${expectedPrefix}` }, 400);
    }

    const svc = createClient(supabaseUrl, serviceKey);

    // Vérifie ownership
    const { data: op, error: opErr } = await svc
      .from("delivery_operators")
      .select("id, owner_user_id, archived_at")
      .eq("id", input.operator_id)
      .maybeSingle();
    if (opErr || !op) return json({ error: "Opérateur introuvable" }, 404);
    if (op.owner_user_id !== userId) return json({ error: "Forbidden — owner only" }, 403);
    if (op.archived_at) return json({ error: "Opérateur archivé" }, 409);

    // Insert
    const { data: row, error: insErr } = await svc
      .from("operator_kyb_documents")
      .insert({
        operator_id: input.operator_id,
        doc_type: input.doc_type,
        file_path: input.file_path,
        file_name: input.file_name,
        mime_type: input.mime_type,
        size_bytes: input.size_bytes,
        uploaded_by: userId,
        status: "pending",
      })
      .select("id, status")
      .single();
    if (insErr) {
      // Cas idempotence (uq_kyb_docs_operator_type_path)
      if (insErr.code === "23505") {
        return json({ success: true, deduplicated: true });
      }
      return json({ error: "Insert failed", details: insErr.message }, 500);
    }

    // Notifie admins
    try {
      const { data: admins } = await svc.from("user_roles").select("user_id").eq("role", "admin");
      if (admins?.length) {
        const rows = admins.map((a: any) => ({
          user_id: a.user_id,
          type: "operator_kyb_doc_uploaded",
          title: "Document KYB opérateur à valider",
          message: `Nouveau ${input.doc_type.toUpperCase()} uploadé par un opérateur.`,
          link: `/admin/operators/${input.operator_id}/kyb`,
        }));
        await svc.from("notifications").insert(rows);
      }
    } catch (_) {}

    return json({ success: true, document_id: row.id, status: row.status });
  } catch (e) {
    console.error("[operator-upload-kyb-document] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}