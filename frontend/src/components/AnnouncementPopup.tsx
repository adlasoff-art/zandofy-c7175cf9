import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { imgUrl } from "@/lib/image-url";

interface PopupData {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  link: string | null;
  link_label: string | null;
  display_frequency: string;
}

export function AnnouncementPopup() {
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("cms_popups" as any)
      .select("*")
      .eq("is_active", true)
      .or("end_date.is.null,end_date.gte." + new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const p = data as any as PopupData;
        
        // Check frequency
        const key = `popup_seen_${p.id}`;
        const lastSeen = localStorage.getItem(key);
        
        if (p.display_frequency === "once" && lastSeen) return;
        if (p.display_frequency === "daily") {
          const today = new Date().toDateString();
          if (lastSeen === today) return;
        }
        
        setPopup(p);
        // Small delay for better UX
        setTimeout(() => setOpen(true), 1500);
      });
  }, []);

  const handleClose = () => {
    setOpen(false);
    if (popup) {
      const key = `popup_seen_${popup.id}`;
      if (popup.display_frequency === "daily") {
        localStorage.setItem(key, new Date().toDateString());
      } else {
        localStorage.setItem(key, "true");
      }
    }
  };

  if (!popup) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {popup.image_url && (
          <img src={imgUrl(popup.image_url, { width: 800 })} alt={popup.title} className="w-full h-48 object-cover" loading="lazy" decoding="async" />
        )}
        <div className="p-5 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-lg">{popup.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">{popup.content}</p>
          <div className="flex gap-2">
            {popup.link && (
              <a href={popup.link} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button className="w-full text-sm">{popup.link_label || "En savoir plus"}</Button>
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
