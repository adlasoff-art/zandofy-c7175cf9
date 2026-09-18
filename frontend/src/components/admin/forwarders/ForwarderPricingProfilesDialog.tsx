import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ForwarderPricingProfilesPanel } from "@/components/forwarder/ForwarderPricingProfilesPanel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forwarderId: string | null;
  forwarderName?: string;
}

export function ForwarderPricingProfilesDialog({ open, onOpenChange, forwarderId, forwarderName }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tarifs — {forwarderName ?? "Transitaire"}</DialogTitle>
        </DialogHeader>
        {forwarderId && open && (
          <ForwarderPricingProfilesPanel
            forwarderId={forwarderId}
            showTransporterOverride
            requireCityOnCreate
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
