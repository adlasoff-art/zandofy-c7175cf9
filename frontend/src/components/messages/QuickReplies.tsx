import { useState, useEffect } from "react";
import { MessageSquareText, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const DEFAULT_REPLIES = [
  "Bonjour ! Comment puis-je vous aider ?",
  "Merci pour votre message, je reviens vers vous rapidement.",
  "Le produit est disponible en stock.",
  "La commande sera expédiée sous 24-48h.",
  "Votre commande a bien été expédiée !",
  "N'hésitez pas si vous avez d'autres questions.",
];

interface QuickRepliesProps {
  onSelect: (text: string) => void;
  storeId: string;
  onManage?: () => void;
}

export function QuickReplies({ onSelect, storeId, onManage }: QuickRepliesProps) {
  const [open, setOpen] = useState(false);
  const [customReplies, setCustomReplies] = useState<string[]>([]);

  useEffect(() => {
    if (!storeId) return;
    supabase
      .from("store_quick_replies")
      .select("content")
      .eq("store_id", storeId)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setCustomReplies(data.map((r: any) => r.content));
      });
  }, [storeId]);

  const allReplies = [...DEFAULT_REPLIES, ...customReplies];

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageSquareText size={12} />
        <span className="flex-1 text-left">Réponses rapides ({allReplies.length})</span>
        {onManage && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onManage(); }}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Gérer les réponses rapides"
          >
            <Settings2 size={12} />
          </span>
        )}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className={cn(
          "flex flex-wrap gap-1.5 px-3 pb-2",
          "max-h-[120px] overflow-y-auto sm:max-h-[160px]"
        )}>
          {allReplies.map((r, i) => (
            <button
              key={i}
              onClick={() => { onSelect(r); setOpen(false); }}
              className={cn(
                "px-2.5 py-1.5 text-[11px] sm:text-[11px] rounded-full border transition-colors truncate",
                "max-w-[200px] sm:max-w-[260px]",
                i < DEFAULT_REPLIES.length
                  ? "border-border bg-muted/50 text-foreground hover:bg-primary/10 hover:border-primary/30"
                  : "border-primary/20 bg-primary/5 text-foreground hover:bg-primary/15 hover:border-primary/40"
              )}
              title={r}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
