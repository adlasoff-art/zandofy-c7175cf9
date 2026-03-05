import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";

const DISPUTE_REASONS = [
  { value: "return_rejected", label: "Retour refusé injustement" },
  { value: "quality_issue", label: "Qualité non conforme" },
  { value: "not_received", label: "Commande non reçue" },
  { value: "partial_delivery", label: "Livraison partielle" },
  { value: "overcharged", label: "Surfacturation" },
  { value: "vendor_unresponsive", label: "Vendeur non réactif" },
  { value: "other", label: "Autre" },
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
      toast.error("Erreur lors de l'ouverture du litige");
    } else {
      toast.success("Litige ouvert avec succès");
      onSuccess();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-600" />
        <h4 className="text-sm font-bold text-foreground">Ouvrir un litige</h4>
      </div>

      <Select value={reason} onValueChange={setReason}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Motif du litige" />
        </SelectTrigger>
        <SelectContent>
          {DISPUTE_REASONS.map(r => (
            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Textarea
        placeholder="Décrivez la situation en détail..."
        value={description}
        onChange={e => setDescription(e.target.value)}
        className="text-sm min-h-[80px]"
        maxLength={2000}
      />

      <p className="text-[11px] text-muted-foreground">
        Un administrateur examinera votre litige et prendra une décision dans les 48h.
      </p>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Annuler</Button>
        <Button size="sm" disabled={!reason || loading} onClick={handleSubmit} className="bg-amber-600 hover:bg-amber-700">
          {loading && <Loader2 size={14} className="animate-spin mr-1" />}
          Soumettre le litige
        </Button>
      </div>
    </div>
  );
}
