import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2 } from "lucide-react";

export default function FooterTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    description: "E-commerce généraliste proposant mode, électronique, maison et bien plus.",
    social_links: { facebook: "#", instagram: "#", twitter: "#", youtube: "#", linkedin: "#" },
    newsletter_email: "newsletter@zandofy.com",
  });

  useEffect(() => {
    supabase.from("platform_settings").select("value").eq("key", "footer_config").maybeSingle().then(({ data }) => {
      if (data?.value) {
        const v = data.value as any;
        setConfig({
          description: v.description || config.description,
          social_links: { ...config.social_links, ...v.social_links },
          newsletter_email: v.newsletter_email || config.newsletter_email,
        });
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("platform_settings").upsert({
      key: "footer_config",
      value: config as any,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Footer enregistré" });
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  const inputClass = "w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Texte de description</h3>
        <Textarea value={config.description} onChange={e => setConfig(prev => ({ ...prev, description: e.target.value }))} rows={3} className="text-sm" />
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Liens réseaux sociaux</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(config.social_links).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <label className="text-xs text-muted-foreground capitalize">{key}</label>
              <input type="text" value={value} onChange={e => setConfig(prev => ({ ...prev, social_links: { ...prev.social_links, [key]: e.target.value } }))} className={inputClass} placeholder={`https://${key}.com/...`} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Email newsletter</h3>
        <input type="email" value={config.newsletter_email} onChange={e => setConfig(prev => ({ ...prev, newsletter_email: e.target.value }))} className={inputClass} placeholder="newsletter@zandofy.com" />
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Enregistrer le footer
      </Button>
    </div>
  );
}
