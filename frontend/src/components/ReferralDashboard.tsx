import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import {
  Users, Copy, Share2, Gift, Loader2, Coins, Clock, CheckCircle2,
  MessageCircle, ArrowUpRight, Wallet, CreditCard, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface ReferralData {
  id: string;
  referee_id: string;
  rewarded_orders_count: number;
  max_rewarded_orders: number;
  commission_pct: number;
  status: string;
  created_at: string;
  referee_email?: string;
}

interface PointsWallet {
  balance: number;
  pending_balance: number;
  total_earned: number;
  total_spent: number;
}

interface PointTransaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

export function ReferralDashboard() {
  const { user } = useAuth();
  const { t, locale, formatPrice } = useI18n();
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<ReferralData[]>([]);
  const [wallet, setWallet] = useState<PointsWallet>({ balance: 0, pending_balance: 0, total_earned: 0, total_spent: 0 });
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransactions, setShowTransactions] = useState(false);
  const [giftCardAmount, setGiftCardAmount] = useState(0);
  const [convertingGiftCard, setConvertingGiftCard] = useState(false);
  const [giftCardEnabled, setGiftCardEnabled] = useState(false);
  const [pointsExpiryMonths, setPointsExpiryMonths] = useState(12);
  const [pointsPerDollar, setPointsPerDollar] = useState(50);
  const [lastActivity, setLastActivity] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [profileRes, referralsRes, walletRes, txRes, settingsRes] = await Promise.all([
      supabase.from("profiles").select("referral_code").eq("id", user.id).single(),
      supabase.from("referrals").select("*").eq("referrer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("zando_points").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("point_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("platform_settings").select("key, value").in("key", ["referral_settings"]),
    ]);

    setReferralCode(profileRes.data?.referral_code || "");

    // Enrich referrals with referee emails
    const refs = referralsRes.data || [];
    if (refs.length > 0) {
      const refereeIds = refs.map(r => r.referee_id);
      const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", refereeIds);
      const emailMap = new Map((profiles || []).map(p => [p.id, p.email]));
      setReferrals(refs.map(r => ({ ...r, referee_email: emailMap.get(r.referee_id) || t("referral.list.user") })));
    } else {
      setReferrals([]);
    }

    if (walletRes.data) {
      setWallet({
        balance: Number(walletRes.data.balance),
        pending_balance: Number(walletRes.data.pending_balance),
        total_earned: Number(walletRes.data.total_earned),
        total_spent: Number(walletRes.data.total_spent),
      });
      setLastActivity((walletRes.data as any).last_activity_at || null);
    }

    // Parse settings
    settingsRes.data?.forEach((row) => {
      const v = row.value as any;
      if (row.key === "referral_settings") {
        setGiftCardEnabled(!!v.gift_card_enabled);
        setPointsExpiryMonths(Number(v.points_expiry_months) || 12);
        setPointsPerDollar(Number(v.points_per_dollar) || 50);
      }
    });

    setTransactions((txRes.data || []) as PointTransaction[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast.success(t("referral.codeCopied"));
  };

  const siteUrl = import.meta.env.VITE_SITE_URL || "https://zandofy.com";

  const shareWhatsApp = () => {
    const msg = t("referral.share.whatsappMsg", { code: referralCode, url: siteUrl });
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const shareSMS = () => {
    const msg = t("referral.share.smsMsg", { code: referralCode, url: siteUrl });
    window.open(`sms:?body=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleConvertToGiftCard = async () => {
    if (!user || giftCardAmount <= 0 || giftCardAmount > wallet.balance) return;
    setConvertingGiftCard(true);

    const dollarValue = giftCardAmount / pointsPerDollar;
    const code = `ZCARD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Deduct points
    const { error: ptErr } = await supabase.from("zando_points").update({
      balance: wallet.balance - giftCardAmount,
      total_spent: wallet.total_spent + giftCardAmount,
    }).eq("user_id", user.id);

    if (ptErr) { toast.error(ptErr.message); setConvertingGiftCard(false); return; }

    // Create gift card with dollar value
    await supabase.from("gift_cards").insert({
      user_id: user.id,
      code,
      original_amount: dollarValue,
      remaining_amount: dollarValue,
      points_used: giftCardAmount,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Log transaction
    await supabase.from("point_transactions").insert({
      user_id: user.id,
      type: "spent",
      amount: -giftCardAmount,
      description: t("referral.giftCard.txDesc", { code, pts: giftCardAmount, amount: dollarValue.toFixed(2) }),
    });

    toast.success(t("referral.giftCard.created", { code, amount: dollarValue.toFixed(2) }));
    setGiftCardAmount(0);
    setConvertingGiftCard(false);
    load();
  };

  // Calculate months until expiration
  const monthsSinceActivity = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (30.44 * 24 * 60 * 60 * 1000))
    : 0;
  const monthsUntilExpiry = Math.max(0, pointsExpiryMonths - monthsSinceActivity);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-4">
      {/* Points Wallet */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Wallet size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">{t("referral.points.title")}</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card/80 rounded-lg p-3 text-center">
            <Coins size={16} className="mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-primary">{wallet.balance}</p>
            <p className="text-[10px] text-muted-foreground">{t("referral.points.available")}</p>
          </div>
          <div className="bg-card/80 rounded-lg p-3 text-center">
            <Clock size={16} className="mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold text-foreground">{wallet.pending_balance}</p>
            <p className="text-[10px] text-muted-foreground">{t("referral.points.pending")}</p>
          </div>
          <div className="bg-card/80 rounded-lg p-3 text-center">
            <ArrowUpRight size={16} className="mx-auto text-emerald-500 mb-1" />
            <p className="text-2xl font-bold text-foreground">{wallet.total_earned}</p>
            <p className="text-[10px] text-muted-foreground">{t("referral.points.totalEarned")}</p>
          </div>
          <div className="bg-card/80 rounded-lg p-3 text-center">
            <Gift size={16} className="mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-bold text-foreground">{wallet.total_spent}</p>
            <p className="text-[10px] text-muted-foreground">{t("referral.points.totalSpent")}</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          {t("referral.points.rate", { rate: pointsPerDollar })}
        </p>
        {wallet.balance > 0 && monthsUntilExpiry <= 3 && (
          <div className="mt-2 flex items-center gap-1.5 justify-center text-[10px] text-amber-600 dark:text-amber-400">
            <AlertTriangle size={12} />
            {monthsUntilExpiry === 0
              ? t("referral.points.expirySoon")
              : t("referral.points.expiryIn", { months: monthsUntilExpiry })}
          </div>
        )}
      </div>

      {/* Gift Card Conversion */}
      {giftCardEnabled && wallet.balance > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard size={18} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground">{t("referral.giftCard.title")}</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {t("referral.giftCard.desc", { rate: pointsPerDollar })}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={wallet.balance}
              value={giftCardAmount || ""}
              onChange={(e) => setGiftCardAmount(Math.min(Number(e.target.value), wallet.balance))}
              placeholder={t("referral.giftCard.placeholder", { max: wallet.balance })}
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
            />
            <button
              onClick={handleConvertToGiftCard}
              disabled={convertingGiftCard || giftCardAmount <= 0 || giftCardAmount > wallet.balance}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {convertingGiftCard ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />}
              {t("referral.giftCard.convert")}
            </button>
          </div>
          {giftCardAmount > 0 && (
            <p className="text-xs text-primary font-medium mt-2 text-center">
              {t("referral.giftCard.preview", { pts: giftCardAmount, amount: (giftCardAmount / pointsPerDollar).toFixed(2) })}
            </p>
          )}
        </div>
      )}

      {/* Referral Code & Sharing */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Share2 size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">{t("referral.title")}</h3>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 bg-muted rounded-lg px-4 py-2.5 font-mono text-sm font-bold text-foreground tracking-wider text-center">
            {referralCode}
          </div>
          <button
            onClick={copyCode}
            className="p-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Copy size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={shareWhatsApp}
            className="flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white text-sm font-medium rounded-lg hover:bg-[#25D366]/90 transition-colors"
          >
            <MessageCircle size={16} /> WhatsApp
          </button>
          <button
            onClick={shareSMS}
            className="flex items-center justify-center gap-2 py-2.5 bg-muted text-foreground text-sm font-medium rounded-lg hover:bg-muted/80 transition-colors"
          >
            <Share2 size={16} /> SMS
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{referrals.length}</p>
            <p className="text-[10px] text-muted-foreground">{t("referral.stats.referees")}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">
              {referrals.reduce((s, r) => s + r.rewarded_orders_count, 0)}
            </p>
            <p className="text-[10px] text-muted-foreground">{t("referral.stats.rewardedOrders")}</p>
          </div>
        </div>
      </div>

      {/* Referrals list */}
      {referrals.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Users size={16} className="text-primary" /> {t("referral.list.title", { count: referrals.length })}
          </h3>
          <div className="space-y-2">
            {referrals.map(ref => (
              <div key={ref.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">{ref.referee_email}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t("referral.list.summary", { used: ref.rewarded_orders_count, max: ref.max_rewarded_orders, pct: ref.commission_pct })}
                  </p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  ref.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {ref.status === "active" ? t("referral.list.statusActive") : t("referral.list.statusEnded")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <button
          onClick={() => setShowTransactions(!showTransactions)}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Coins size={16} className="text-primary" /> {t("referral.tx.title")}
          </h3>
          <span className="text-xs text-primary">{showTransactions ? t("referral.tx.hide") : t("referral.tx.show")}</span>
        </button>
        {showTransactions && (
          <div className="mt-3 space-y-2">
            {transactions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t("referral.tx.empty")}</p>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    {tx.type === "earned" && <ArrowUpRight size={12} className="text-emerald-500" />}
                    {tx.type === "spent" && <Gift size={12} className="text-blue-500" />}
                    {tx.type === "voided" && <Clock size={12} className="text-destructive" />}
                    {tx.type === "pending" && <Clock size={12} className="text-amber-500" />}
                    {tx.type === "expired" && <AlertTriangle size={12} className="text-destructive" />}
                    <div>
                      <p className="text-xs text-foreground">{tx.description || tx.type}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR")}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${
                    tx.type === "spent" || tx.type === "voided" || tx.type === "expired" ? "text-destructive" : "text-primary"
                  }`}>
                    {tx.type === "spent" || tx.type === "voided" ? "-" : "+"}{Math.abs(Number(tx.amount))}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
