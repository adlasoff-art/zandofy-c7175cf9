import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, X, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DEFAULT_REPLIES = [
  "Bonjour ! Comment puis-je vous aider ?",
  "Merci pour votre message, je reviens vers vous rapidement.",
  "Le produit est disponible en stock.",
  "La commande sera expédiée sous 24-48h.",
  "Votre commande a bien été expédiée !",
  "N'hésitez pas si vous avez d'autres questions.",
];

const MAX_CUSTOM = 25;

interface QuickReply {
  id: string;
  content: string;
  sort_order: number;
}

interface QuickRepliesManagerProps {
  storeId: string;
  onClose: () => void;
}

export function QuickRepliesManager({ storeId, onClose }: QuickRepliesManagerProps) {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchReplies = async () => {
    setLoading(true);
    const { data } = await (supabase
      .from("store_quick_replies" as any)
      .select("id, content, sort_order")
      .eq("store_id", storeId)
      .order("sort_order", { ascending: true }) as any);
    if (data) setReplies(data as QuickReply[]);
    setLoading(false);
  };

  useEffect(() => { fetchReplies(); }, [storeId]);

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text || text.length < 2) {
      toast.error("Le texte doit contenir au moins 2 caractères.");
      return;
    }
    if (replies.length >= MAX_CUSTOM) {
      toast.error(`Maximum ${MAX_CUSTOM} réponses rapides personnalisées.`);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("store_quick_replies").insert({
      store_id: storeId,
      content: text,
      sort_order: replies.length,
    });
    if (error) {
      toast.error(error.message.includes("Maximum") ? error.message : "Erreur lors de l'ajout");
    } else {
      setNewText("");
      await fetchReplies();
      toast.success("Réponse rapide ajoutée");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("store_quick_replies").delete().eq("id", id);
    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      setReplies((prev) => prev.filter((r) => r.id !== id));
      toast.success("Supprimée");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-foreground">Réponses rapides</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Default replies (read-only) */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Par défaut (non modifiables)
          </p>
          <div className="space-y-1">
            {DEFAULT_REPLIES.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 text-sm text-muted-foreground"
              >
                <span className="flex-1 truncate">{r}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Custom replies */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Personnalisées ({replies.length}/{MAX_CUSTOM})
          </p>
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : replies.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Aucune réponse personnalisée</p>
          ) : (
            <div className="space-y-1">
              {replies.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-background border border-border text-sm group"
                >
                  <span className="flex-1 truncate text-foreground">{r.content}</span>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add new */}
      {replies.length < MAX_CUSTOM && (
        <div className="border-t border-border px-4 py-3 flex gap-2 shrink-0">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Nouvelle réponse rapide..."
            className="text-sm"
            maxLength={500}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          />
          <Button size="sm" onClick={handleAdd} disabled={saving || !newText.trim()}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </Button>
        </div>
      )}
    </div>
  );
}
