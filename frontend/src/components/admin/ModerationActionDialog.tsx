import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MODERATION_REJECTION_REASONS, type ModerationReasonId } from "@/lib/vendor-tiers";
import { AlertTriangle, RotateCcw, X, Link as LinkIcon } from "lucide-react";

type ActionType = "rejected" | "revision_requested";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: ActionType;
  productName: string;
  onConfirm: (reason: string, link: string | null) => void;
  isLoading?: boolean;
}

export function ModerationActionDialog({ open, onOpenChange, actionType, productName, onConfirm, isLoading }: Props) {
  const [selectedReason, setSelectedReason] = useState<ModerationReasonId | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [policyLink, setPolicyLink] = useState("");

  const isRejection = actionType === "rejected";
  const title = isRejection ? "Rejeter le produit" : "Renvoyer pour révision";
  const icon = isRejection ? <X size={16} className="text-destructive" /> : <RotateCcw size={16} className="text-orange-500" />;

  const selectedReasonObj = MODERATION_REJECTION_REASONS.find(r => r.id === selectedReason);
  const isOther = selectedReason === "other";

  const buildReasonText = () => {
    if (!selectedReason) return "";
    if (isOther) return customReason.trim();
    const base = selectedReasonObj ? `${selectedReasonObj.label} — ${selectedReasonObj.description}` : "";
    return customReason.trim() ? `${base}\n\n${customReason.trim()}` : base;
  };

  const canSubmit = selectedReason && (isOther ? customReason.trim().length > 0 : true);

  const handleConfirm = () => {
    const reason = buildReasonText();
    if (!reason) return;
    onConfirm(reason, policyLink.trim() || null);
    // Reset on close
    setSelectedReason(null);
    setCustomReason("");
    setPolicyLink("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSelectedReason(null);
      setCustomReason("");
      setPolicyLink("");
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icon}
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Produit : <strong className="text-foreground">{productName}</strong>
          </p>

          {/* Predefined reasons */}
          <div>
            <Label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">
              Raison {isRejection ? "du rejet" : "de la révision"}
            </Label>
            <div className="grid gap-1.5 max-h-48 overflow-y-auto">
              {MODERATION_REJECTION_REASONS.map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => setSelectedReason(reason.id)}
                  className={`text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                    selectedReason === reason.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="font-medium text-foreground">{reason.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{reason.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom reason / additional details */}
          <div>
            <Label htmlFor="custom-reason" className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 block">
              {isOther ? "Raison personnalisée *" : "Détails supplémentaires (optionnel)"}
            </Label>
            <Textarea
              id="custom-reason"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder={isOther ? "Décrivez la raison du rejet ou de la révision..." : "Ajoutez des précisions pour le vendeur..."}
              rows={3}
              className="text-sm"
            />
          </div>

          {/* Policy link */}
          <div>
            <Label htmlFor="policy-link" className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
              <LinkIcon size={12} />
              Lien vers le règlement (optionnel)
            </Label>
            <Input
              id="policy-link"
              type="url"
              value={policyLink}
              onChange={(e) => setPolicyLink(e.target.value)}
              placeholder="https://zandofy.com/reglements/..."
              className="text-sm"
            />
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-2.5">
            <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {isRejection
                ? "Le vendeur sera notifié du rejet avec la raison indiquée. Il devra resoumettre un nouveau produit."
                : "Le vendeur sera invité à corriger son produit et le resoumettre pour approbation."
              }
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Annuler
          </Button>
          <Button
            variant={isRejection ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={!canSubmit || isLoading}
            className={!isRejection ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
          >
            {isLoading ? "..." : isRejection ? "Confirmer le rejet" : "Renvoyer pour révision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
