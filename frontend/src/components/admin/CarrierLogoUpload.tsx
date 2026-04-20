import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { sanitizeExtension } from "@/utils/sanitize-filename";

export function CarrierLogoUpload() {
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "shipping_label_config")
      .single()
      .then(({ data }) => {
        if (data?.value) {
          const v = data.value as any;
          setLogoUrl(v.carrier_logo_url || "");
        }
      });
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large (max 2MB)");
      return;
    }

    setUploading(true);
    const ext = sanitizeExtension(file.name, "png");
    const path = `carrier-logos/carrier-logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("product-media")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("product-media").getPublicUrl(path);
    const url = urlData?.publicUrl || "";

    setLogoUrl(url);
    await saveSetting(url);
    setUploading(false);
    toast.success("Logo uploaded");
  };

  const saveSetting = async (url: string) => {
    setSaving(true);
    await supabase
      .from("platform_settings")
      .upsert(
        {
          key: "shipping_label_config",
          value: { carrier_logo_url: url } as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    setSaving(false);
  };

  const handleRemove = async () => {
    setLogoUrl("");
    await saveSetting("");
    toast.success("Logo removed");
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">Carrier Logo (Shipping Labels)</Label>
      <p className="text-xs text-muted-foreground">
        Upload the carrier/logistics logo to display on shipping labels instead of text.
        Recommended: PNG with transparent background, max 2MB.
      </p>

      {logoUrl && (
        <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
          <img src={logoUrl} alt="Carrier logo" className="max-h-12 max-w-[140px] object-contain" />
          <Button variant="ghost" size="sm" onClick={handleRemove}>
            <Trash2 size={14} />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          disabled={uploading}
          className="max-w-xs"
        />
        {(uploading || saving) && <Loader2 className="animate-spin" size={16} />}
      </div>
    </div>
  );
}
