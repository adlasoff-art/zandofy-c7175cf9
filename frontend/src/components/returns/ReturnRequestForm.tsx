import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RotateCcw, Loader2 } from "lucide-react";

const RETURN_REASONS = [
  { value: "defective", label: "Produit défectueux" },
  { value: "wrong_item", label: "Mauvais article reçu" },
  { value: "not_as_described", label: "Non conforme à la description" },
  { value: "size_issue", label: "Problème de taille" },
  { value: "changed_mind", label: "Changement d'avis" },
  { value: "damaged", label: "Produit endommagé" },
  { value: "other", label: "Autre" },
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
      toast.error("Erreur lors de la demande de retour");
    } else {
      toast.success("Demande de retour soumise !");
      onSuccess();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4 bg-muted/30 border border-border rounded-lg p-4">
      <div className="flex items-center gap-2">
        <RotateCcw size={16} className="text-primary" />
        <h4 className="text-sm font-bold text-foreground">Demande de retour — {orderRef}</h4>
      </div>

      <Select value={reason} onValueChange={setReason}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Motif du retour" />
        </SelectTrigger>
        <SelectContent>
          {RETURN_REASONS.map(r => (
            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Textarea
        placeholder="Décrivez le problème en détail..."
        value={description}
        onChange={e => setDescription(e.target.value)}
        className="text-sm min-h-[80px]"
        maxLength={1000}
      />

      <p className="text-xs text-muted-foreground">
        Montant de remboursement estimé : <strong>${orderTotal.toFixed(2)}</strong>
      </p>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Annuler</Button>
        <Button size="sm" disabled={!reason || loading} onClick={handleSubmit}>
          {loading && <Loader2 size={14} className="animate-spin mr-1" />}
          Soumettre
        </Button>
      </div>
    </div>
  );
}
