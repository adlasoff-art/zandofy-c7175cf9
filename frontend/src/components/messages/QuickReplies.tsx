import { useState } from "react";
import { MessageSquareText, ChevronDown, ChevronUp } from "lucide-react";
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
}

export function QuickReplies({ onSelect }: QuickRepliesProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageSquareText size={12} />
        Réponses rapides
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {DEFAULT_REPLIES.map((r, i) => (
            <button
              key={i}
              onClick={() => { onSelect(r); setOpen(false); }}
              className="px-2.5 py-1 text-[11px] rounded-full border border-border bg-muted/50 text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors truncate max-w-[220px]"
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
