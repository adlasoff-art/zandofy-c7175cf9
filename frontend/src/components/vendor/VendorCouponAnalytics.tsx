import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, Ticket, Loader2, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

interface CouponStats {
  code: string;
  discount_type: string;
  discount_value: number;
  current_uses: number;
  is_active: boolean;
  revenue_generated: number;
}

interface DailyUsage {
  date: string;
  uses: number;
}

export function VendorCouponAnalytics({ storeId }: { storeId: string }) {
  const [coupons, setCoupons] = useState<CouponStats[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    // Fetch store coupons
    const { data: couponData } = await supabase
      .from("store_coupons")
      .select("code, discount_type, discount_value, current_uses, is_active")
      .eq("store_id", storeId)
      .order("current_uses", { ascending: false });

    // Fetch orders with coupon codes for this store
    const { data: orders } = await supabase
      .from("orders")
      .select("coupon_code, total, created_at, discount_amount")
      .eq("store_id", storeId)
      .not("coupon_code", "is", null);

    // Calculate revenue per coupon
    const revenueMap = new Map<string, number>();
    const dailyMap = new Map<string, number>();

    (orders || []).forEach(order => {
      const code = order.coupon_code;
      if (code) {
        revenueMap.set(code, (revenueMap.get(code) || 0) + Number(order.total));
        const day = new Date(order.created_at).toISOString().split("T")[0];
        dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
      }
    });

    setCoupons(
      (couponData || []).map(c => ({
        ...c,
        revenue_generated: revenueMap.get(c.code) || 0,
      }))
    );

    // Build daily usage for last 14 days
    const days: DailyUsage[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      days.push({ date: key, uses: dailyMap.get(key) || 0 });
    }
    setDailyUsage(days);

    setLoading(false);
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;
  }

  const totalUses = coupons.reduce((s, c) => s + c.current_uses, 0);
  const totalRevenue = coupons.reduce((s, c) => s + c.revenue_generated, 0);
  const avgConversion = totalUses > 0 ? ((totalRevenue / totalUses)).toFixed(2) : "0";

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Ticket size={14} className="mx-auto text-primary mb-1" />
          <p className="text-lg font-bold text-foreground">{totalUses}</p>
          <p className="text-[10px] text-muted-foreground">Utilisations</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <DollarSign size={14} className="mx-auto text-emerald-500 mb-1" />
          <p className="text-lg font-bold text-foreground">${totalRevenue.toFixed(0)}</p>
          <p className="text-[10px] text-muted-foreground">Revenu généré</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <TrendingUp size={14} className="mx-auto text-blue-500 mb-1" />
          <p className="text-lg font-bold text-foreground">${avgConversion}</p>
          <p className="text-[10px] text-muted-foreground">Panier moyen</p>
        </div>
      </div>

      {/* Daily Usage Chart */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <BarChart3 size={14} className="text-primary" /> Utilisations par jour (14 derniers jours)
        </h4>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyUsage}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9 }}
                tickFormatter={(v) => new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                className="fill-muted-foreground"
              />
              <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" allowDecimals={false} />
              <Tooltip
                labelFormatter={(v) => new Date(v).toLocaleDateString("fr-FR")}
                contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: "hsl(var(--border))" }}
              />
              <Line type="monotone" dataKey="uses" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Utilisations" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Coupons */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp size={14} className="text-primary" /> Top coupons
        </h4>
        {coupons.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Aucune donnée</p>
        ) : (
          <>
            <div className="h-36 mb-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={coupons.slice(0, 5)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                  <YAxis type="category" dataKey="code" tick={{ fontSize: 10 }} className="fill-muted-foreground" width={80} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="current_uses" fill="hsl(var(--primary))" name="Utilisations" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="space-y-1">
              {coupons.map((c, i) => (
                <div key={c.code} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="font-mono font-bold text-foreground">{c.code}</span>
                    <span className="text-muted-foreground">
                      {c.discount_type === "percentage" ? `${c.discount_value}%` : `$${c.discount_value}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>{c.current_uses} uses</span>
                    <span className="font-medium text-foreground">${c.revenue_generated.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
