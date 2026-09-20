import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Loader2 } from "lucide-react";

/** PDP RFQ CTA — hide when rfq_enabled is false (I9). */
export function ProductRfqButton({ productId }: { productId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("10");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: enabled = false } = useQuery({
    queryKey: ["rfq-enabled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "rfq_enabled")
        .maybeSingle();
      return (data?.value as { enabled?: boolean } | null)?.enabled === true;
    },
    staleTime: 10 * 60 * 1000,
  });

  if (!enabled) return null;

  const submit = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    const quantity = Math.max(1, parseInt(qty, 10) || 1);
    setSaving(true);
    const { error } = await (supabase as any).from("product_rfq_requests").insert({
      user_id: user.id,
      product_id: productId,
      quantity,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Demande envoyée", description: "Le vendeur recevra votre RFQ." });
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      {!open ? (
        <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)}>
          <ClipboardList size={16} className="mr-2" />
          Demande de devis (RFQ)
        </Button>
      ) : (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <Input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Quantité"
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optionnel)"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="button" className="flex-1" disabled={saving} onClick={() => void submit()}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Envoyer"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
