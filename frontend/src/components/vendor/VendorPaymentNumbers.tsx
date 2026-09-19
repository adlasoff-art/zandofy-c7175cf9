/**
 * Vendor component to manage mobile money payment numbers + preferred + QR.
 * Allowed via resolveOffPlatformAccess (grant / subscription / 30d trial).
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Loader2, Save, Star, Upload } from "lucide-react";
import { toast } from "sonner";
import { resolveOffPlatformAccess } from "@/hooks/use-vendor-off-platform-access";
import { sanitizeExtension } from "@/utils/sanitize-filename";

const DEFAULT_OPERATORS = [
  { operator: "orange_money", operator_label: "Orange Money", sort_order: 0 },
  { operator: "mpesa", operator_label: "M-Pesa", sort_order: 1 },
  { operator: "airtel_money", operator_label: "Airtel Money", sort_order: 2 },
  { operator: "afrimoney", operator_label: "AfriMoney", sort_order: 3 },
];

interface NumberEntry {
  operator: string;
  operator_label: string;
  phone_number: string;
  display_name: string;
  sort_order: number;
  is_preferred: boolean;
  qr_image_url: string;
}

export function VendorPaymentNumbers({ storeId }: { storeId: string }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [accessReason, setAccessReason] = useState<string>("denied");
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<NumberEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingOp, setUploadingOp] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const access = await resolveOffPlatformAccess(storeId);
      setAllowed(access.allowed);
      setAccessReason(access.reason);
      setTrialEndsAt(access.trialEndsAt);

      if (!access.allowed) {
        setLoading(false);
        return;
      }

      const { data: existing } = await (supabase as any)
        .from("store_payment_numbers")
        .select(
          "operator, operator_label, phone_number, display_name, sort_order, is_preferred, qr_image_url",
        )
        .eq("store_id", storeId)
        .order("sort_order");

      if (existing && existing.length > 0) {
        const merged = DEFAULT_OPERATORS.map((def) => {
          const found = existing.find((e: NumberEntry) => e.operator === def.operator);
          return found
            ? {
                ...def,
                phone_number: found.phone_number || "",
                display_name: found.display_name || "",
                is_preferred: !!found.is_preferred,
                qr_image_url: found.qr_image_url || "",
              }
            : { ...def, phone_number: "", display_name: "", is_preferred: false, qr_image_url: "" };
        });
        setNumbers(merged);
      } else {
        setNumbers(
          DEFAULT_OPERATORS.map((d) => ({
            ...d,
            phone_number: "",
            display_name: "",
            is_preferred: false,
            qr_image_url: "",
          })),
        );
      }
      setLoading(false);
    }
    load();
  }, [storeId]);

  const setPreferred = (operator: string) => {
    setNumbers((prev) =>
      prev.map((n) => ({ ...n, is_preferred: n.operator === operator })),
    );
  };

  const uploadQr = async (operator: string, file: File) => {
    const allowedMime = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedMime.includes(file.type)) {
      toast.error("QR : image JPEG, PNG ou WebP uniquement");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("QR : max 2 Mo");
      return;
    }
    setUploadingOp(operator);
    try {
      // product-media is public + store-owner folder policy (vendor-documents is private + uid folder)
      const ext = sanitizeExtension(file.name, "jpg");
      const path = `${storeId}/payment-qr/${operator}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("product-media")
        .upload(path, file, {
          cacheControl: "31536000",
          upsert: true,
          contentType: file.type,
        });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("product-media").getPublicUrl(path);
      const url = pub?.publicUrl;
      if (!url) throw new Error("URL publique introuvable");
      setNumbers((prev) =>
        prev.map((n) => (n.operator === operator ? { ...n, qr_image_url: url } : n)),
      );
      toast.success("QR téléversé — enregistrez pour confirmer");
    } catch (e: any) {
      toast.error(e?.message || "Upload QR impossible");
    } finally {
      setUploadingOp(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const withPhone = numbers.filter((n) => n.phone_number.trim());
      if (withPhone.length === 0) {
        toast.error("Ajoutez au moins un numéro");
        setSaving(false);
        return;
      }
      // Ensure at most one preferred among saved rows
      let preferredSet = false;
      const toSave = numbers.map((n) => {
        const hasPhone = !!n.phone_number.trim();
        let isPreferred = hasPhone && n.is_preferred;
        if (isPreferred && preferredSet) isPreferred = false;
        if (isPreferred) preferredSet = true;
        return {
          operator: n.operator,
          operator_label: n.operator_label,
          phone_number: n.phone_number,
          display_name: n.display_name,
          sort_order: n.sort_order,
          is_preferred: isPreferred,
          qr_image_url: n.qr_image_url,
          is_active: hasPhone,
        };
      });
      if (!preferredSet && withPhone[0]) {
        for (const n of toSave) {
          if (n.operator === withPhone[0].operator) n.is_preferred = true;
        }
      }

      const { error: clearErr } = await (supabase as any)
        .from("store_payment_numbers")
        .update({ is_preferred: false })
        .eq("store_id", storeId);
      if (clearErr) throw clearErr;

      for (const n of toSave) {
        const { error } = await (supabase as any).from("store_payment_numbers").upsert(
          {
            store_id: storeId,
            operator: n.operator,
            operator_label: n.operator_label,
            phone_number: n.phone_number.trim(),
            display_name: n.display_name.trim(),
            sort_order: n.sort_order,
            is_preferred: n.is_preferred,
            qr_image_url: n.qr_image_url || null,
            is_active: n.is_active,
          },
          { onConflict: "store_id,operator" },
        );
        if (error) throw error;
      }
      setNumbers(
        toSave.map(({ is_active: _a, ...rest }) => ({
          ...rest,
          phone_number: rest.phone_number,
        })),
      );
      toast.success("Numéros enregistrés");
    } catch (e: any) {
      toast.error(e?.message || "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="animate-spin text-primary" size={20} />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="text-xs text-muted-foreground border border-border rounded-md p-3">
        Accès numéros / QR indisponible ({accessReason === "denied" ? "essai terminé ou non activé" : accessReason}).
        Souscrivez le forfait ou contactez l’admin.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Phone size={14} />
        Numéros & QR hors plateforme
      </div>
      {accessReason === "trial" && trialEndsAt && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          Essai jusqu’au {new Date(trialEndsAt).toLocaleDateString("fr-FR")}
        </p>
      )}
      {numbers.map((n) => (
        <div key={n.operator} className="border border-border rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">{n.operator_label}</span>
            <button
              type="button"
              onClick={() => setPreferred(n.operator)}
              className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border ${
                n.is_preferred
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              <Star size={10} className={n.is_preferred ? "fill-primary" : ""} />
              Préféré
            </button>
          </div>
          <input
            className="w-full h-9 px-2 text-sm border border-border rounded-md bg-background"
            placeholder="Numéro"
            value={n.phone_number}
            onChange={(e) =>
              setNumbers((prev) =>
                prev.map((x) =>
                  x.operator === n.operator ? { ...x, phone_number: e.target.value } : x,
                ),
              )
            }
          />
          <input
            className="w-full h-9 px-2 text-sm border border-border rounded-md bg-background"
            placeholder="Nom affiché (optionnel)"
            value={n.display_name}
            onChange={(e) =>
              setNumbers((prev) =>
                prev.map((x) =>
                  x.operator === n.operator ? { ...x, display_name: e.target.value } : x,
                ),
              )
            }
          />
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1 text-[11px] text-primary cursor-pointer">
              {uploadingOp === n.operator ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Upload size={12} />
              )}
              QR code
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingOp === n.operator}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadQr(n.operator, f);
                }}
              />
            </label>
            {n.qr_image_url && (
              <img
                src={n.qr_image_url}
                alt="QR"
                className="h-10 w-10 object-contain rounded border border-border"
              />
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
        Enregistrer les numéros
      </button>
    </div>
  );
}
