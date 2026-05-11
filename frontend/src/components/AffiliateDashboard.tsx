import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { Loader2, Award, TrendingUp, Users, Star, ChevronRight, Link2 } from "lucide-react";
import { AffiliateLinksManager } from "@/components/affiliate/AffiliateLinksManager";

interface AffiliateTier {
  id: string;
  tier_name: string;
  badge_label: string;
  min_referrals: number;
  commission_pct: number;
  bonus_points: number;
}

export function AffiliateDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [tiers, setTiers] = useState<AffiliateTier[]>([]);
  const [currentTier, setCurrentTier] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bonusEnabled, setBonusEnabled] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      const [tiersRes, profileRes, referralsRes, settingsRes] = await Promise.all([
        supabase.from("affiliate_tiers").select("*").order("min_referrals"),
        supabase.from("profiles").select("affiliate_tier").eq("id", user!.id).single(),
        supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", user!.id),
        supabase.from("platform_settings").select("value").eq("key", "referral_settings").maybeSingle(),
      ]);
      setTiers((tiersRes.data || []) as AffiliateTier[]);
      setCurrentTier(profileRes.data?.affiliate_tier || null);
      setReferralCount(referralsRes.count || 0);
      if (settingsRes.data?.value) {
        const v = settingsRes.data.value as any;
        setBonusEnabled(!!v.affiliate_bonus_enabled);
      }
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  if (tiers.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <Award size={40} className="mx-auto text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">{t("affiliate.notConfigured")}</p>
      </div>
    );
  }

  const currentTierData = tiers.find(t => t.tier_name === currentTier);
  const currentIdx = currentTierData ? tiers.indexOf(currentTierData) : -1;
  const nextTier = currentIdx < tiers.length - 1 ? tiers[currentIdx + 1] : null;
  const referralsNeeded = nextTier ? Math.max(0, nextTier.min_referrals - referralCount) : 0;

  return (
    <div className="space-y-4">
      {/* Current tier */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Award size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">{t("affiliate.your.title")}</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <Star size={24} className="text-primary" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{currentTierData?.badge_label || t("affiliate.beginner")}</p>
            <p className="text-xs text-muted-foreground">
              {currentTierData ? t("affiliate.commissionPct", { pct: currentTierData.commission_pct }) : t("affiliate.noTier")}
            </p>
            <p className="text-xs text-primary font-medium">{t("affiliate.referees", { count: referralCount })}</p>
          </div>
        </div>

        {nextTier && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{t("affiliate.next", { name: nextTier.badge_label })}</span>
              <span>{t("affiliate.remaining", { count: referralsNeeded })}</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(100, (referralCount / nextTier.min_referrals) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* All tiers */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-primary" /> {t("affiliate.tiers.title")}
        </h3>
        <div className="space-y-2">
          {tiers.map((tier, i) => {
            const isActive = tier.tier_name === currentTier;
            const isReached = referralCount >= tier.min_referrals;
            return (
              <div
                key={tier.id}
                className={`p-3 rounded-lg border transition-colors ${
                  isActive ? "border-primary bg-primary/5" : isReached ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isActive ? "bg-primary text-primary-foreground" : isReached ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{tier.badge_label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {t("affiliate.tier.summary", { min: tier.min_referrals, pct: tier.commission_pct })}
                        {bonusEnabled && tier.bonus_points > 0 && t("affiliate.tier.bonus", { pts: tier.bonus_points })}
                      </p>
                    </div>
                  </div>
                  {isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-semibold">{t("affiliate.tier.current")}</span>}
                  {!isActive && isReached && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-semibold">{t("affiliate.tier.reached")}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Affiliate Links Manager */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
          <Link2 size={16} className="text-primary" /> {t("affiliate.links.title")}
        </h3>
        <AffiliateLinksManager />
      </div>
    </div>
  );
}
