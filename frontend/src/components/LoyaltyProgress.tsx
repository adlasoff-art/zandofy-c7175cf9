import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { Crown, ChevronRight, Loader2, Award } from "lucide-react";
import { toast } from "sonner";

interface Tier {
  id: string;
  tier_name: string;
  badge_label: string;
  min_orders: number;
  min_spent: number;
  discount_pct: number;
  sort_order: number;
}

export function LoyaltyProgress() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [stats, setStats] = useState<{ total_orders: number; total_spent: number } | null>(null);
  const [currentTier, setCurrentTier] = useState("client");
  const [requesting, setRequesting] = useState(false);
  const [existingRequest, setExistingRequest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [tiersRes, statsRes, profileRes, reqRes] = await Promise.all([
        supabase.from("customer_tiers").select("*").order("sort_order"),
        supabase.rpc("get_customer_loyalty_stats", { p_user_id: user!.id }),
        supabase.from("profiles").select("customer_tier").eq("id", user!.id).single(),
        supabase.from("badge_requests").select("requested_tier, status").eq("user_id", user!.id).eq("status", "pending").limit(1),
      ]);
      setTiers(tiersRes.data?.map((t: any) => ({ ...t, min_spent: Number(t.min_spent), discount_pct: Number(t.discount_pct) })) || []);
      if (statsRes.data && Array.isArray(statsRes.data) && statsRes.data.length > 0) {
        setStats({ total_orders: Number(statsRes.data[0].total_orders), total_spent: Number(statsRes.data[0].total_spent) });
      }
      setCurrentTier(profileRes.data?.customer_tier || "client");
      setExistingRequest(reqRes.data?.[0]?.requested_tier || null);
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading || !stats) return null;

  const currentTierObj = tiers.find((t) => t.tier_name === currentTier);
  const currentIdx = currentTierObj ? currentTierObj.sort_order : 0;
  const nextTier = tiers.find((t) => t.sort_order === currentIdx + 1);

  // Check eligibility for next tier
  const isEligible = nextTier && stats.total_orders >= nextTier.min_orders && stats.total_spent >= nextTier.min_spent;

  // Progress toward next tier
  const ordersProgress = nextTier ? Math.min(100, (stats.total_orders / nextTier.min_orders) * 100) : 100;
  const spentProgress = nextTier ? Math.min(100, (stats.total_spent / nextTier.min_spent) * 100) : 100;
  const ordersRemaining = nextTier ? Math.max(0, nextTier.min_orders - stats.total_orders) : 0;
  const spentRemaining = nextTier ? Math.max(0, nextTier.min_spent - stats.total_spent) : 0;

  const requestBadge = async () => {
    if (!nextTier || !user) return;
    setRequesting(true);
    const { error } = await supabase.from("badge_requests").insert({
      user_id: user.id,
      requested_tier: nextTier.tier_name,
    });
    setRequesting(false);
    if (error) { toast.error(error.message); return; }
    setExistingRequest(nextTier.tier_name);
    toast.success(t("loyalty.requestSuccess", { name: nextTier.badge_label }));
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Crown size={18} className="text-primary" />
        <h3 className="text-sm font-bold text-foreground">{t("loyalty.title")}</h3>
      </div>

      {/* Current tier */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Award size={18} className="text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("loyalty.currentBadge")}</p>
          <p className="font-bold text-foreground">{currentTierObj?.badge_label || t("loyalty.client")}</p>
          {currentTierObj && Number(currentTierObj.discount_pct) > 0 && (
            <p className="text-xs text-primary font-medium">{t("loyalty.discountAll", { pct: currentTierObj.discount_pct })}</p>
          )}
        </div>
      </div>

      {/* Progress to next */}
      {nextTier ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t("loyalty.next")} <span className="font-semibold text-foreground">{nextTier.badge_label}</span> {t("loyalty.nextPct", { pct: nextTier.discount_pct })}
          </p>

          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>{t("loyalty.orders", { current: stats.total_orders, target: nextTier.min_orders })}</span>
              <span>{ordersRemaining > 0 ? t("loyalty.ordersRemaining", { count: ordersRemaining }) : "✓"}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${ordersProgress}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>{t("loyalty.spent", { current: stats.total_spent.toLocaleString(), target: nextTier.min_spent.toLocaleString() })}</span>
              <span>{spentRemaining > 0 ? t("loyalty.spentRemaining", { amount: spentRemaining.toLocaleString() }) : "✓"}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${spentProgress}%` }} />
            </div>
          </div>

          {isEligible && (
            <div className="mt-3">
              {existingRequest ? (
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center font-medium">
                  {t("loyalty.requestPending")}
                </div>
              ) : (
                <button
                  onClick={requestBadge}
                  disabled={requesting}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  {requesting ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />}
                  {t("loyalty.requestBtn", { name: nextTier.badge_label })}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-emerald-600 font-medium">{t("loyalty.maxLevel")}</p>
      )}
    </div>
  );
}
