import { useState, useEffect } from "react";
import { useAutomation } from "@/hooks/use-automation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { logAutomationEvent } from "@/lib/automation-tracking";

export function AutomationPopup() {
  const { matchedWorkflow, variant, loading, recordDisplay } = useAutomation();
  const [open, setOpen] = useState(false);
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    if (!loading && matchedWorkflow) {
      const delay = matchedWorkflow.delay_minutes > 0 ? matchedWorkflow.delay_minutes * 60 * 1000 : 1500;
      const timer = setTimeout(() => setOpen(true), Math.min(delay, 5000));
      return () => clearTimeout(timer);
    }
  }, [loading, matchedWorkflow]);

  useEffect(() => {
    if (open && matchedWorkflow) {
      const v = variant?.variant_label || 'A';
      recordDisplay(matchedWorkflow.id, v);
      logAutomationEvent(matchedWorkflow.id, "delivered_popup", { variant: v });
      setInteracted(false);
    }
  }, [open, matchedWorkflow, variant, recordDisplay]);

  if (!matchedWorkflow) return null;

  const c = {
    title: variant?.popup_title ?? matchedWorkflow.popup_title,
    content: variant?.popup_content ?? matchedWorkflow.popup_content,
    image: variant?.popup_image_url ?? matchedWorkflow.popup_image_url,
    ctaLabel: variant?.popup_cta_label ?? matchedWorkflow.popup_cta_label,
    ctaLink: variant?.popup_cta_link ?? matchedWorkflow.popup_cta_link,
  };
  const vLabel = variant?.variant_label || 'A';

  const handleClose = () => {
    if (!interacted && matchedWorkflow) {
      logAutomationEvent(matchedWorkflow.id, "dismissed_popup", { variant: vLabel });
    }
    setOpen(false);
  };

  const handleCtaClick = () => {
    if (matchedWorkflow) {
      setInteracted(true);
      logAutomationEvent(matchedWorkflow.id, "clicked_popup_cta", {
        destination: c.ctaLink,
        variant: vLabel,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {c.image && (
          <img
            src={c.image}
            alt={c.title || ""}
            className="w-full h-48 object-cover"
          />
        )}
        <div className="p-5 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {c.title || matchedWorkflow.name}
            </DialogTitle>
          </DialogHeader>
          {c.content && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {c.content}
            </p>
          )}
          <div className="flex gap-2">
            {c.ctaLink && (
              <a
                href={c.ctaLink}
                target={c.ctaLink.startsWith("http") ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className="flex-1"
                onClick={handleCtaClick}
              >
                <Button className="w-full text-sm">
                  {c.ctaLabel || "En savoir plus"}
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
