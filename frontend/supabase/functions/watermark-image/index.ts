// Watermark an image stored in Supabase Storage and overwrite the original.
// Lot 10 — Volet C — single-version embedded watermark.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Position =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

interface WatermarkConfig {
  enabled: boolean;
  logo_url: string;
  position: Position;
  opacity: number; // 0..1
  size_ratio: number; // logo width / image width
  margin_ratio: number; // margin / image width
}

function isImageContentType(ct: string | null): boolean {
  if (!ct) return false;
  return ct.startsWith("image/") && !ct.includes("svg") && !ct.includes("gif");
}

function placeOffset(
  pos: Position,
  imgW: number,
  imgH: number,
  logoW: number,
  logoH: number,
  margin: number,
) {
  switch (pos) {
    case "top-left":
      return { x: margin, y: margin };
    case "top-right":
      return { x: imgW - logoW - margin, y: margin };
    case "bottom-left":
      return { x: margin, y: imgH - logoH - margin };
    case "center":
      return { x: Math.floor((imgW - logoW) / 2), y: Math.floor((imgH - logoH) / 2) };
    case "bottom-right":
    default:
      return { x: imgW - logoW - margin, y: imgH - logoH - margin };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { bucket, path } = await req.json();
    if (!bucket || !path || typeof bucket !== "string" || typeof path !== "string") {
      return new Response(
        JSON.stringify({ error: "bucket and path required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load watermark_config
    const { data: settingRow } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "watermark_config")
      .maybeSingle();

    const config = (settingRow?.value ?? {}) as Partial<WatermarkConfig>;
    if (!config.enabled || !config.logo_url) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "watermark disabled or no logo" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Download the original image
    const { data: file, error: dlErr } = await admin.storage.from(bucket).download(path);
    if (dlErr || !file) {
      return new Response(
        JSON.stringify({ error: "download failed", detail: dlErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ct = file.type || "image/jpeg";
    if (!isImageContentType(ct)) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "not a watermarkable image type" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseBytes = new Uint8Array(await file.arrayBuffer());
    const baseImg = await Image.decode(baseBytes);

    // Download logo
    const logoRes = await fetch(config.logo_url);
    if (!logoRes.ok) {
      return new Response(
        JSON.stringify({ error: "logo fetch failed", status: logoRes.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const logoBytes = new Uint8Array(await logoRes.arrayBuffer());
    let logoImg = await Image.decode(logoBytes);

    const sizeRatio = Math.min(Math.max(config.size_ratio ?? 0.12, 0.04), 0.5);
    const targetLogoW = Math.max(32, Math.floor(baseImg.width * sizeRatio));
    const targetLogoH = Math.max(
      16,
      Math.floor((logoImg.height / logoImg.width) * targetLogoW),
    );
    logoImg = logoImg.resize(targetLogoW, targetLogoH);

    // Apply opacity
    const opacity = Math.min(Math.max(config.opacity ?? 0.5, 0.05), 1);
    if (opacity < 1) {
      logoImg.opacity(opacity);
    }

    const marginRatio = Math.min(Math.max(config.margin_ratio ?? 0.02, 0), 0.2);
    const margin = Math.floor(baseImg.width * marginRatio);
    const { x, y } = placeOffset(
      (config.position as Position) || "bottom-right",
      baseImg.width,
      baseImg.height,
      targetLogoW,
      targetLogoH,
      margin,
    );

    baseImg.composite(logoImg, x, y);

    // Encode as JPEG to keep size predictable; PNG inputs become JPEG outputs (acceptable for product photos)
    const isPng = ct.includes("png");
    const outBytes = isPng ? await baseImg.encode() : await baseImg.encodeJPEG(85);
    const outCt = isPng ? "image/png" : "image/jpeg";

    const { error: upErr } = await admin.storage.from(bucket).upload(path, outBytes, {
      upsert: true,
      contentType: outCt,
      cacheControl: "31536000",
    });
    if (upErr) {
      return new Response(
        JSON.stringify({ error: "upload failed", detail: upErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, bucket, path }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "watermark failed", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
