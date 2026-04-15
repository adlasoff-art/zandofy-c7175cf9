import { useState, useEffect } from "react";
import { useAutomation } from "@/hooks/use-automation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function AutomationPopup() {
  const { matchedWorkflow, loading, recordDisplay } = useAutomation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && matchedWorkflow) {
      const delay = matchedWorkflow.delay_minutes > 0 ? matchedWorkflow.delay_minutes * 60 * 1000 : 1500;
      const timer = setTimeout(() => setOpen(true), Math.min(delay, 5000));
      return () => clearTimeout(timer);
    }
  }, [loading, matchedWorkflow]);

  useEffect(() => {
    if (open && matchedWorkflow) {
      recordDisplay(matchedWorkflow.id);
    }
  }, [open, matchedWorkflow, recordDisplay]);

  if (!matchedWorkflow) return null;

  const handleClose = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {matchedWorkflow.popup_image_url && (
          <img
            src={matchedWorkflow.popup_image_url}
            alt={matchedWorkflow.popup_title || ""}
            className="w-full h-48 object-cover"
          />
        )}
        <div className="p-5 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {matchedWorkflow.popup_title || matchedWorkflow.name}
            </DialogTitle>
          </DialogHeader>
          {matchedWorkflow.popup_content && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {matchedWorkflow.popup_content}
            </p>
          )}
          <div className="flex gap-2">
            {matchedWorkflow.popup_cta_link && (
              <a
                href={matchedWorkflow.popup_cta_link}
                target={matchedWorkflow.popup_cta_link.startsWith("http") ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button className="w-full text-sm">
                  {matchedWorkflow.popup_cta_label || "En savoir plus"}
                </Button>
              </a>
            )}
            <Button variant="outline" onClick={handleClose} className="text-sm">
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
