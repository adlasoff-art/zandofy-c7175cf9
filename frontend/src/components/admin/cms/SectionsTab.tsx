import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { GripVertical, LayoutDashboard, Loader2 } from "lucide-react";

export default function SectionsTab() {
  const { toast } = useToast();
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("cms_homepage_sections").select("*").order("sort_order");
    setSections(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("cms_homepage_sections").update({ is_active: !active }).eq("id", id);
    toast({ title: active ? "Section désactivée" : "Section activée" });
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Activez ou désactivez les blocs de la page d'accueil.</p>
      {sections.map((s) => (
        <div key={s.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <GripVertical size={16} className="text-muted-foreground/40 cursor-grab shrink-0" />
          <LayoutDashboard size={18} className="text-primary/60 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{s.label}</p>
            <p className="text-xs text-muted-foreground font-mono">{s.section_key}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Switch checked={s.is_active} onCheckedChange={() => handleToggle(s.id, s.is_active)} />
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {s.is_active ? "Actif" : "Inactif"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
