import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";

const DISPUTE_REASON_VALUES = [
  { value: "return_rejected", labelKey: "dispute.reason.return_rejected.long" },
  { value: "quality_issue", labelKey: "dispute.reason.quality_issue" },
  { value: "not_received", labelKey: "dispute.reason.not_received" },
  { value: "partial_delivery", labelKey: "dispute.reason.partial_delivery" },
  { value: "overcharged", labelKey: "dispute.reason.overcharged" },
  { value: "vendor_unresponsive", labelKey: "dispute.reason.vendor_unresponsive" },
  { value: "other", labelKey: "dispute.reason.other" },
];

interface Props {
  orderId: string;
  storeId: string | null;
  returnRequestId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DisputeForm({ orderId, storeId, returnRequestId, onSuccess, onCancel }: Props) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason) return;
    setLoading(true);

    const { error } = await supabase.from("disputes").insert({
      order_id: orderId,
      user_id: user.id,
      store_id: storeId,
      return_request_id: returnRequestId || null,
      reason,
      description: description.trim(),
    });

    if (error) {
      toast.error(t("dispute.form.error") || "Erreur lors de l'ouverture du litige");
    } else {
      toast.success(t("dispute.form.success") || "Litige ouvert avec succès");
      onSuccess();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-600" />
        <h4 className="text-sm font-bold text-foreground">{t("dispute.form.title") || "Ouvrir un litige"}</h4>
      </div>

      <Select value={reason} onValueChange={setReason}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={t("dispute.form.reasonPlaceholder") || "Motif du litige"} />
        </SelectTrigger>
        <SelectContent>
          {DISPUTE_REASON_VALUES.map(r => (
            <SelectItem key={r.value} value={r.value}>{t(r.labelKey)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Textarea
        placeholder={t("dispute.form.descriptionPlaceholder") || "Décrivez la situation en détail..."}
        value={description}
        onChange={e => setDescription(e.target.value)}
        className="text-sm min-h-[80px]"
        maxLength={2000}
      />

      <p className="text-[11px] text-muted-foreground">
        {t("dispute.form.notice") || "Un administrateur examinera votre litige et prendra une décision dans les 48h."}
      </p>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>{t("dispute.form.cancel") || "Annuler"}</Button>
        <Button size="sm" disabled={!reason || loading} onClick={handleSubmit} className="bg-amber-600 hover:bg-amber-700">
          {loading && <Loader2 size={14} className="animate-spin mr-1" />}
          {t("dispute.form.submit") || "Soumettre le litige"}
        </Button>
      </div>
    </div>
  );
}
