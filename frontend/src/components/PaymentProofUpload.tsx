import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/utils/image-compress";
import { Camera, Upload, Loader2, CheckCircle, X, Image } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentProofUploadProps {
  orderId: string;
  field: "shipping_payment_proof_url" | "last_mile_payment_proof_url" | "hub_pickup_proof_url";
  label?: string;
  onUploaded?: (url: string) => void;
  existingUrl?: string | null;
}

export function PaymentProofUpload({ orderId, field, label = "Preuve de paiement", onUploaded, existingUrl }: PaymentProofUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError("Fichier trop volumineux (max 10 Mo)");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Format non supporté. Utilisez JPG, PNG ou WebP.");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const compressed = await compressImage(file);
      const ext = compressed.name.split(".").pop() || "jpg";
      const path = `payment-proofs/${orderId}/${field}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("delivery-proofs")
        .upload(path, compressed, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("delivery-proofs")
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl;

      // Update order with proof URL
      const { error: updateError } = await supabase
        .from("orders")
        .update({ [field]: publicUrl } as any)
        .eq("id", orderId);

      if (updateError) throw updateError;

      setPreviewUrl(publicUrl);
      onUploaded?.(publicUrl);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const removeProof = () => {
    setPreviewUrl(null);
    // Don't remove from DB, just allow re-upload
  };

  if (previewUrl) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
          <CheckCircle size={12} className="text-primary" /> {label}
        </p>
        <div className="relative inline-block">
          <img
            src={previewUrl}
            alt="Preuve de paiement"
            className="w-32 h-32 object-cover rounded-lg border border-border"
          />
          <button
            onClick={removeProof}
            className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
          >
            <X size={10} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">{label}</p>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <div className="flex gap-2">
        {/* File upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="text-xs gap-1.5"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          Importer
        </Button>

        {/* Camera capture (mobile) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => cameraInputRef.current?.click()}
          className="text-xs gap-1.5"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
          Photo
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Capture d'écran ou photo de la transaction (JPG, PNG, max 10 Mo)
      </p>
    </div>
  );
}
