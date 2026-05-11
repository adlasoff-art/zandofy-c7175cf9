import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RotateCcw, Loader2 } from "lucide-react";

const RETURN_REASON_VALUES = [
  { value: "defective", labelKey: "returns.reason.defective" },
  { value: "wrong_item", labelKey: "returns.reason.wrong_item.long" },
  { value: "not_as_described", labelKey: "returns.reason.not_as_described.long" },
  { value: "size_issue", labelKey: "returns.reason.size_issue" },
  { value: "changed_mind", labelKey: "returns.reason.changed_mind" },
  { value: "damaged", labelKey: "returns.reason.damaged" },
  { value: "other", labelKey: "returns.reason.other" },
];

interface Props {
  orderId: string;
  orderRef: string;
  storeId: string | null;
  orderTotal: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ReturnRequestForm({ orderId, orderRef, storeId, orderTotal, onSuccess, onCancel }: Props) {
  const { user } = useAuth();
  const { t, formatPrice } = useI18n();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason) return;
    setLoading(true);

    const { error } = await supabase.from("return_requests").insert({
      order_id: orderId,
      user_id: user.id,
      store_id: storeId,
      reason,
      description: description.trim(),
      refund_amount: orderTotal,
    });

    if (error) {
      toast.error(t("returns.form.error") || "Erreur lors de la demande de retour");
    } else {
      toast.success(t("returns.form.success") || "Demande de retour soumise !");
      onSuccess();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4 bg-muted/30 border border-border rounded-lg p-4">
      <div className="flex items-center gap-2">
        <RotateCcw size={16} className="text-primary" />
        <h4 className="text-sm font-bold text-foreground">{t("returns.form.title", { ref: orderRef }) || `Demande de retour — ${orderRef}`}</h4>
      </div>

      <Select value={reason} onValueChange={setReason}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={t("returns.form.reasonPlaceholder") || "Motif du retour"} />
        </SelectTrigger>
        <SelectContent>
          {RETURN_REASON_VALUES.map(r => (
            <SelectItem key={r.value} value={r.value}>{t(r.labelKey)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Textarea
        placeholder={t("returns.form.descriptionPlaceholder") || "Décrivez le problème en détail..."}
        value={description}
        onChange={e => setDescription(e.target.value)}
        className="text-sm min-h-[80px]"
        maxLength={1000}
      />

      <p className="text-xs text-muted-foreground">
        {t("returns.form.estimatedRefund") || "Montant de remboursement estimé :"} <strong>{formatPrice(orderTotal)}</strong>
      </p>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>{t("returns.form.cancel") || "Annuler"}</Button>
        <Button size="sm" disabled={!reason || loading} onClick={handleSubmit}>
          {loading && <Loader2 size={14} className="animate-spin mr-1" />}
          {t("returns.form.submit") || "Soumettre"}
        </Button>
      </div>
    </div>
  );
}
