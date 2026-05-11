import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Plus, Copy, Trash2, Loader2, MousePointer, ShoppingBag, DollarSign, TrendingUp } from "lucide-react";

interface AffiliateLink {
  id: string;
  code: string;
  label: string | null;
  product_id: string | null;
  category_id: string | null;
  custom_commission_pct: number | null;
  clicks: number;
  conversions: number;
  revenue_generated: number;
  is_active: boolean;
  created_at: string;
}

export function AffiliateLinksManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("affiliate_links")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setLinks((data || []) as AffiliateLink[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const createLink = async () => {
    if (!user) return;
    setCreating(true);
    const code = `AFF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const { error } = await (supabase as any).from("affiliate_links").insert({
      user_id: user.id,
      code,
      label: newLabel.trim() || null,
    });
    if (error) {
      toast({ title: t("affiliate.links.error"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("affiliate.links.created") });
      setNewLabel("");
      load();
    }
    setCreating(false);
  };

  const copyLink = (code: string) => {
    const url = `${window.location.origin}?ref=${code}`;
    navigator.clipboard.writeText(url);
    toast({ title: t("affiliate.links.copied") });
  };

  const deleteLink = async (id: string) => {
    const { error } = await (supabase as any).from("affiliate_links").delete().eq("id", id);
    if (error) toast({ title: t("affiliate.links.error"), description: error.message, variant: "destructive" });
    else { toast({ title: t("affiliate.links.deleted") }); load(); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
  const totalConversions = links.reduce((s, l) => s + l.conversions, 0);
  const totalRevenue = links.reduce((s, l) => s + l.revenue_generated, 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <MousePointer size={16} className="mx-auto text-primary mb-1" />
          <p className="text-lg font-bold text-foreground">{totalClicks}</p>
          <p className="text-[10px] text-muted-foreground">{t("affiliate.links.clicks")}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <ShoppingBag size={16} className="mx-auto text-primary mb-1" />
          <p className="text-lg font-bold text-foreground">{totalConversions}</p>
          <p className="text-[10px] text-muted-foreground">{t("affiliate.links.conversions")}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <DollarSign size={16} className="mx-auto text-primary mb-1" />
          <p className="text-lg font-bold text-foreground">${totalRevenue.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">{t("affiliate.links.revenue")}</p>
        </div>
      </div>

      {/* Create new link */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <Link2 size={16} className="text-primary" />
          {t("affiliate.links.create")}
        </h3>
        <div className="flex gap-2">
          <Input
            placeholder={t("affiliate.links.placeholder")}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="flex-1"
          />
          <Button onClick={createLink} disabled={creating} size="sm" className="gap-1.5">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {t("affiliate.links.createBtn")}
          </Button>
        </div>
      </div>

      {/* Links list */}
      <div className="space-y-2">
        {links.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("affiliate.links.empty")}
          </p>
        )}
        {links.map((link) => (
          <div key={link.id} className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-bold text-foreground">{link.label || link.code}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {window.location.origin}?ref={link.code}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(link.code)}>
                  <Copy size={14} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteLink(link.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><MousePointer size={10} /> {t("affiliate.links.clicksShort", { count: link.clicks })}</span>
              <span className="flex items-center gap-1"><ShoppingBag size={10} /> {t("affiliate.links.convShort", { count: link.conversions })}</span>
              <span className="flex items-center gap-1"><DollarSign size={10} /> ${link.revenue_generated.toFixed(2)}</span>
              {link.custom_commission_pct && (
                <span className="flex items-center gap-1"><TrendingUp size={10} /> {link.custom_commission_pct}%</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
