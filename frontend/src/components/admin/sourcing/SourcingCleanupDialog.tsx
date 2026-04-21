import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCleaned: () => void;
}

export function SourcingCleanupDialog({ open, onOpenChange, onCleaned }: Props) {
  const { toast } = useToast();
  const [preset, setPreset] = useState("30");
  const [custom, setCustom] = useState("");
  const [working, setWorking] = useState(false);

  const days = preset === "custom" ? Number(custom) : Number(preset);

  const onConfirm = async () => {
    if (!Number.isFinite(days) || days < 0) {
      toast({ title: "Délai invalide", variant: "destructive" });
      return;
    }
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-sourcing", {
        body: { older_than_days: days },
      });
      if (error) throw error;
      toast({
        title: "Nettoyage terminé",
        description: `${data?.deleted_count ?? 0} demandes supprimées.`,
      });
      onCleaned();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Nettoyer les demandes de sourcing</AlertDialogTitle>
          <AlertDialogDescription>
            Supprime définitivement les demandes plus anciennes que la période choisie, ainsi que leurs images.
            Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <Label>Période</Label>
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Plus de 7 jours</SelectItem>
              <SelectItem value="30">Plus de 30 jours</SelectItem>
              <SelectItem value="90">Plus de 90 jours</SelectItem>
              <SelectItem value="custom">Personnalisé…</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <Input
              type="number"
              min="1"
              placeholder="Nombre de jours"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={working}>Annuler</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={onConfirm} disabled={working}>
              {working ? <Loader2 className="animate-spin mr-2" size={16} /> : <Trash2 size={16} className="mr-2" />}
              Nettoyer
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}