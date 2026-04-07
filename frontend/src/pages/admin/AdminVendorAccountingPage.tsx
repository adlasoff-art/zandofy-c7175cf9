import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, Loader2, Store, ChevronDown, ChevronRight, Building2, User2,
  TrendingUp, DollarSign, BarChart3, CreditCard, Smartphone, Receipt,
  Percent, Gift, Users, ShieldCheck, ArrowDownRight, ArrowUpRight, Minus
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/exports/ExportButton";

type Period = "7d" | "14d" | "30d" | "3m" | "6m" | "1y" | "all";

const periodOptions: { value: Period; label: string }[] = [
  { value: "7d", label: "7 jours" },
  { value: "14d", label: "14 jours" },
  { value: "30d", label: "30 jours" },
  { value: "3m", label: "3 mois" },
  { value: "6m", label: "6 mois" },
  { value: "1y", label: "1 an" },
  { value: "all", label: "Tout" },
];

function getSinceDate(period: Period): string | null {
  const now = new Date();
  switch (period) {
    case "7d": now.setDate(now.getDate() - 7); break;
    case "14d": now.setDate(now.getDate() - 14); break;
    case "30d": now.setDate(now.getDate() - 30); break;
    case "3m": now.setMonth(now.getMonth() - 3); break;
    case "6m": now.setMonth(now.getMonth() - 6); break;
    case "1y": now.setFullYear(now.getFullYear() - 1); break;
    case "all": return null;
  }
  return now.toISOString();
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Gateway fee rates by payment method */
const GATEWAY_RATES: Record<string, number> = {
  mobile_money: 2.5,
  stripe: 3.5,
  card: 3.5,
  paypal: 3.9,
  cod: 0,
  off_platform: 0,
  unknown: 0,
};

function getGatewayRate(method: string): number {
  return GATEWAY_RATES[method] ?? 0;
}

interface OrderDetail {
  orderId: string;
  orderRef: string;
  paymentMethod: string;
  subtotal: number;
  discountAmount: number;
  couponCode: string | null;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    costReal: number;
    costCalc: number;
    vendorExtra: number;
    revenue: number;
  }[];
  // Computed
  totalRevenue: number;
  totalCostReal: number;
  totalCostCalc: number;
  costSpread: number; // cost_calc - cost_real
  gatewayFeePct: number;
  gatewayFeeAmount: number;
  referralDeduction: number;
  affiliateDeduction: number;
  loyaltyDiscount: number;
  totalDeductions: number;
  grossMargin: number;
  grossMarginPct: number;
  netMargin: number;
  netMarginPct: number;
  vendorExtraTotal: number;
}

interface StoreAccounting {
  id: string;
  name: string;
  isPlatform: boolean;
  commissionRate: number;
  orders: OrderDetail[];
  // Aggregated
  totalRevenue: number;
  totalCostReal: number;
  totalCostCalc: number;
  totalCostSpread: number;
  totalGatewayFees: number;
  totalReferralDeductions: number;
  totalAffiliateDeductions: number;
  totalLoyaltyDiscounts: number;
  totalDeductions: number;
  grossMargin: number;
  grossMarginPct: number;
  netMargin: number;
  netMarginPct: number;
  totalVendorExtra: number;
  platformCommission: number;
  netDueVendor: number;
  platformNetRevenue: number;
  walletAvailable: number;
  walletPending: number;
  revenueByMethod: Record<string, number>;
  ordersCount: number;
}

export default function AdminVendorAccountingPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [search, setSearch] = useState("");
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const since = getSinceDate(period);

  const { data: stores } = useQuery({
    queryKey: ["accounting-stores"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("stores").select("id, name, owner_id, is_platform_owned").order("name");
      return (data || []) as { id: string; name: string; owner_id: string; is_platform_owned: boolean }[];
    },
  });

  const { data: overrides } = useQuery({
    queryKey: ["accounting-overrides"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("vendor_pricing_overrides").select("store_id, commission_rate, vendor_extra_margin_enabled");
      return data || [];
    },
  });

  const { data: globalDefaults } = useQuery({
    queryKey: ["pricing-defaults-accounting"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("value").eq("key", "pricing_defaults").single();
      return data?.value as any || {};
    },
  });

  // Fetch delivered orders WITH items joined
  const { data: rawOrders, isLoading } = useQuery({
    queryKey: ["accounting-orders", period],
    queryFn: async () => {
      let q = (supabase as any)
        .from("orders")
        .select("id, order_ref, status, store_id, created_at, subtotal, total, payment_method, discount_amount, coupon_code")
        .eq("status", "delivered");
      if (since) q = q.gte("created_at", since);
      const { data } = await q.limit(5000);
      return data || [];
    },
  });

  const { data: orderItems } = useQuery({
    queryKey: ["accounting-items", period],
    queryFn: async () => {
      if (!rawOrders || rawOrders.length === 0) return [];
      const orderIds = rawOrders.map((o: any) => o.id);
      // Fetch in batches of 500
      const allItems: any[] = [];
      for (let i = 0; i < orderIds.length; i += 500) {
        const batch = orderIds.slice(i, i + 500);
        const { data } = await (supabase as any)
          .from("order_items")
          .select("id, order_id, product_id, product_name, price, quantity")
          .in("order_id", batch);
        if (data) allItems.push(...data);
      }
      return allItems;
    },
    enabled: !!rawOrders && rawOrders.length > 0,
  });

  const { data: products } = useQuery({
    queryKey: ["accounting-products"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("products")
        .select("id, cost_real, cost_calc, vendor_extra_margin, store_id, name");
      return (data || []) as { id: string; cost_real: number | null; cost_calc: number | null; vendor_extra_margin: number | null; store_id: string | null; name: string }[];
    },
  });

  const { data: wallets } = useQuery({
    queryKey: ["accounting-wallets"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("vendor_wallets").select("store_id, available_balance, pending_balance, total_earned");
      return data || [];
    },
  });

  // Referral point transactions per order
  const { data: referralTxns } = useQuery({
    queryKey: ["accounting-referral-txns", period],
    queryFn: async () => {
      let q = (supabase as any)
        .from("point_transactions")
        .select("order_id, amount, type, referral_id")
        .not("referral_id", "is", null)
        .in("type", ["earned", "pending"]);
      if (since) q = q.gte("created_at", since);
      const { data } = await q;
      return (data || []) as { order_id: string | null; amount: number; type: string; referral_id: string | null }[];
    },
  });

  // Affiliate clicks/conversions per order (approximate via affiliate_links revenue)
  const { data: affiliateData } = useQuery({
    queryKey: ["accounting-affiliates"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("affiliate_links").select("id, user_id, revenue_generated, conversions, custom_commission_pct");
      return (data || []) as { id: string; user_id: string; revenue_generated: number; conversions: number; custom_commission_pct: number | null }[];
    },
  });

  const storeAccounting = useMemo((): StoreAccounting[] => {
    if (!stores || !rawOrders || !products || !overrides) return [];

    const productMap = new Map(products.map((p) => [p.id, p]));
    const overrideMap = new Map((overrides as any[]).map((o: any) => [o.store_id, o]));
    const walletMap = new Map((wallets || []).map((w: any) => [w.store_id, w]));
    const defaultCommission = Number(globalDefaults?.platform_commission_default) || 10;

    // Build referral deductions per order
    const referralByOrder = new Map<string, number>();
    (referralTxns || []).forEach((t) => {
      if (!t.order_id) return;
      referralByOrder.set(t.order_id, (referralByOrder.get(t.order_id) || 0) + Math.abs(Number(t.amount)));
    });

    // Group order items by order_id
    const itemsByOrder = new Map<string, any[]>();
    (orderItems || []).forEach((item: any) => {
      if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
      itemsByOrder.get(item.order_id)!.push(item);
    });

    // Group orders by store
    const ordersByStore = new Map<string, any[]>();
    (rawOrders as any[]).forEach((o) => {
      if (!o.store_id) return;
      if (!ordersByStore.has(o.store_id)) ordersByStore.set(o.store_id, []);
      ordersByStore.get(o.store_id)!.push(o);
    });

    return (stores as any[])
      .filter((s: any) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
      .map((store: any): StoreAccounting => {
        const storeOrders = ordersByStore.get(store.id) || [];
        const override = overrideMap.get(store.id) as any;
        const wallet = walletMap.get(store.id) as any;
        const isPlatform = store.is_platform_owned || false;
        const commissionRate = isPlatform ? 0 : Number(override?.commission_rate) || defaultCommission;
        const extraMarginEnabled = override?.vendor_extra_margin_enabled ?? false;

        const revenueByMethod: Record<string, number> = {};
        const orderDetails: OrderDetail[] = [];

        let aggRevenue = 0, aggCostReal = 0, aggCostCalc = 0, aggGateway = 0;
        let aggReferral = 0, aggAffiliate = 0, aggLoyalty = 0, aggVendorExtra = 0;

        for (const order of storeOrders) {
          const items = itemsByOrder.get(order.id) || [];
          const method = order.payment_method || "unknown";
          const gatewayPct = getGatewayRate(method);
          const discountAmt = Number(order.discount_amount || 0);
          const referralDed = referralByOrder.get(order.id) || 0;

          let orderRevenue = 0, orderCostReal = 0, orderCostCalc = 0, orderVendorExtra = 0;
          const orderItemDetails: OrderDetail["items"] = [];

          for (const item of items) {
            const product = productMap.get(item.product_id);
            const qty = item.quantity || 1;
            const revenue = (item.price || 0) * qty;
            const costReal = (product?.cost_real || 0) * qty;
            const costCalc = (product?.cost_calc || 0) * qty;
            const vendorExtra = extraMarginEnabled ? (product?.vendor_extra_margin || 0) * qty : 0;

            orderRevenue += revenue;
            orderCostReal += costReal;
            orderCostCalc += costCalc;
            orderVendorExtra += vendorExtra;

            orderItemDetails.push({
              productId: item.product_id,
              productName: item.product_name || product?.name || "—",
              quantity: qty,
              unitPrice: item.price || 0,
              costReal: product?.cost_real || 0,
              costCalc: product?.cost_calc || 0,
              vendorExtra: extraMarginEnabled ? (product?.vendor_extra_margin || 0) : 0,
              revenue,
            });
          }

          const gatewayFee = orderRevenue * (gatewayPct / 100);
          const costSpread = orderCostCalc - orderCostReal;
          const grossMargin = orderRevenue - orderCostReal - gatewayFee;
          const totalDeductions = referralDed + discountAmt;
          const netMargin = grossMargin - totalDeductions - orderVendorExtra;

          revenueByMethod[method] = (revenueByMethod[method] || 0) + orderRevenue;

          orderDetails.push({
            orderId: order.id,
            orderRef: order.order_ref,
            paymentMethod: method,
            subtotal: Number(order.subtotal),
            discountAmount: discountAmt,
            couponCode: order.coupon_code,
            items: orderItemDetails,
            totalRevenue: orderRevenue,
            totalCostReal: orderCostReal,
            totalCostCalc: orderCostCalc,
            costSpread,
            gatewayFeePct: gatewayPct,
            gatewayFeeAmount: gatewayFee,
            referralDeduction: referralDed,
            affiliateDeduction: 0,
            loyaltyDiscount: discountAmt,
            totalDeductions,
            grossMargin,
            grossMarginPct: orderRevenue > 0 ? (grossMargin / orderRevenue) * 100 : 0,
            netMargin,
            netMarginPct: orderRevenue > 0 ? (netMargin / orderRevenue) * 100 : 0,
            vendorExtraTotal: orderVendorExtra,
          });

          aggRevenue += orderRevenue;
          aggCostReal += orderCostReal;
          aggCostCalc += orderCostCalc;
          aggGateway += gatewayFee;
          aggReferral += referralDed;
          aggLoyalty += discountAmt;
          aggVendorExtra += orderVendorExtra;
        }

        const totalDeductions = aggGateway + aggReferral + aggLoyalty;
        const grossMargin = aggRevenue - aggCostReal - aggGateway;
        const netMargin = grossMargin - aggReferral - aggLoyalty - aggVendorExtra;
        const platformCommission = isPlatform ? 0 : aggRevenue * (commissionRate / 100);
        const netDueVendor = isPlatform ? aggVendorExtra : aggRevenue - platformCommission;
        const platformNetRevenue = isPlatform
          ? netMargin
          : platformCommission - aggGateway;

        return {
          id: store.id,
          name: store.name,
          isPlatform,
          commissionRate,
          orders: orderDetails,
          totalRevenue: aggRevenue,
          totalCostReal: aggCostReal,
          totalCostCalc: aggCostCalc,
          totalCostSpread: aggCostCalc - aggCostReal,
          totalGatewayFees: aggGateway,
          totalReferralDeductions: aggReferral,
          totalAffiliateDeductions: aggAffiliate,
          totalLoyaltyDiscounts: aggLoyalty,
          totalDeductions,
          grossMargin,
          grossMarginPct: aggRevenue > 0 ? (grossMargin / aggRevenue) * 100 : 0,
          netMargin,
          netMarginPct: aggRevenue > 0 ? (netMargin / aggRevenue) * 100 : 0,
          totalVendorExtra: aggVendorExtra,
          platformCommission,
          netDueVendor,
          platformNetRevenue,
          walletAvailable: Number(wallet?.available_balance || 0),
          walletPending: Number(wallet?.pending_balance || 0),
          revenueByMethod,
          ordersCount: storeOrders.length,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [stores, rawOrders, orderItems, products, overrides, wallets, globalDefaults, referralTxns, search]);

  // Totals
  const totals = useMemo(() => {
    return storeAccounting.reduce(
      (acc, s) => ({
        revenue: acc.revenue + s.totalRevenue,
        costReal: acc.costReal + s.totalCostReal,
        costCalc: acc.costCalc + s.totalCostCalc,
        costSpread: acc.costSpread + s.totalCostSpread,
        gatewayFees: acc.gatewayFees + s.totalGatewayFees,
        referral: acc.referral + s.totalReferralDeductions,
        loyalty: acc.loyalty + s.totalLoyaltyDiscounts,
        grossMargin: acc.grossMargin + s.grossMargin,
        netMargin: acc.netMargin + s.netMargin,
        vendorExtra: acc.vendorExtra + s.totalVendorExtra,
        commission: acc.commission + s.platformCommission,
        netDue: acc.netDue + s.netDueVendor,
        platformNet: acc.platformNet + s.platformNetRevenue,
        platformStores: acc.platformStores + (s.isPlatform ? 1 : 0),
        independentStores: acc.independentStores + (s.isPlatform ? 0 : 1),
        ordersCount: acc.ordersCount + s.ordersCount,
      }),
      {
        revenue: 0, costReal: 0, costCalc: 0, costSpread: 0,
        gatewayFees: 0, referral: 0, loyalty: 0,
        grossMargin: 0, netMargin: 0, vendorExtra: 0,
        commission: 0, netDue: 0, platformNet: 0,
        platformStores: 0, independentStores: 0, ordersCount: 0,
      }
    );
  }, [storeAccounting]);

  const top10Data = useMemo(() => {
    return storeAccounting.slice(0, 10).map((s) => ({
      name: s.name.length > 15 ? s.name.slice(0, 15) + "…" : s.name,
      CA: Math.round(s.totalRevenue * 100) / 100,
      "Marge brute": Math.round(s.grossMargin * 100) / 100,
      "Marge nette": Math.round(s.netMargin * 100) / 100,
    }));
  }, [storeAccounting]);

  const exportRows = useMemo(() => {
    return storeAccounting.map(s => ({
      boutique: s.name,
      type: s.isPlatform ? "Plateforme" : "Indépendant",
      commission_pct: s.commissionRate,
      ca_livre: s.totalRevenue.toFixed(2),
      cout_reel: s.totalCostReal.toFixed(2),
      cout_calcul: s.totalCostCalc.toFixed(2),
      ecart_cout: s.totalCostSpread.toFixed(2),
      frais_passerelle: s.totalGatewayFees.toFixed(2),
      deduction_parrainage: s.totalReferralDeductions.toFixed(2),
      reduction_fidelite: s.totalLoyaltyDiscounts.toFixed(2),
      marge_brute: s.grossMargin.toFixed(2),
      marge_brute_pct: s.grossMarginPct.toFixed(1),
      marge_nette: s.netMargin.toFixed(2),
      marge_nette_pct: s.netMarginPct.toFixed(1),
      bonus_vendeur: s.totalVendorExtra.toFixed(2),
      commission: s.platformCommission.toFixed(2),
      net_du: s.netDueVendor.toFixed(2),
      revenu_plateforme: s.platformNetRevenue.toFixed(2),
    }));
  }, [storeAccounting]);

  const methodLabel = (m: string) => {
    const labels: Record<string, string> = {
      mobile_money: "Mobile Money (2.5%)", stripe: "Carte (3.5%)", card: "Carte (3.5%)",
      cod: "Contre remboursement", off_platform: "Hors plateforme",
      paypal: "PayPal (3.9%)", unknown: "Non spécifié",
    };
    return labels[m] || m;
  };

  const MarginBadge = ({ pct }: { pct: number }) => (
    <Badge variant={pct >= 20 ? "default" : pct >= 10 ? "secondary" : "destructive"} className="text-[9px] ml-1">
      {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
    </Badge>
  );

  return (
    <AdminLayout title="Comptabilité vendeurs">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher une boutique..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {periodOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ExportButton
            data={exportRows}
            columns={[
              { key: "boutique", label: "Boutique" }, { key: "type", label: "Type" },
              { key: "ca_livre", label: "CA livré ($)" }, { key: "cout_reel", label: "Coût réel ($)" },
              { key: "cout_calcul", label: "Coût calcul ($)" }, { key: "ecart_cout", label: "Écart coût ($)" },
              { key: "frais_passerelle", label: "Frais passerelle ($)" },
              { key: "deduction_parrainage", label: "Parrainage ($)" },
              { key: "reduction_fidelite", label: "Fidélité ($)" },
              { key: "marge_brute", label: "Marge brute ($)" }, { key: "marge_brute_pct", label: "Marge brute %" },
              { key: "marge_nette", label: "Marge nette ($)" }, { key: "marge_nette_pct", label: "Marge nette %" },
              { key: "bonus_vendeur", label: "Bonus vendeur ($)" },
              { key: "commission", label: "Commission ($)" }, { key: "net_du", label: "Net dû ($)" },
              { key: "revenu_plateforme", label: "Revenu plateforme ($)" },
            ]}
            filename="comptabilite-vendeurs"
            label="Export CSV"
          />
        </div>

        {/* KPI Cards - 2 rows */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            { label: "CA livré", value: `$${fmt(totals.revenue)}`, icon: DollarSign, color: "text-emerald-600", sub: `${totals.ordersCount} commandes` },
            { label: "Coût réel", value: `$${fmt(totals.costReal)}`, icon: Receipt, color: "text-orange-600", sub: `Écart: $${fmt(totals.costSpread)}` },
            { label: "Frais passerelle", value: `$${fmt(totals.gatewayFees)}`, icon: CreditCard, color: "text-red-500" },
            { label: "Marge brute", value: `$${fmt(totals.grossMargin)}`, icon: TrendingUp, color: "text-emerald-600", sub: `${totals.revenue > 0 ? ((totals.grossMargin / totals.revenue) * 100).toFixed(1) : 0}%` },
            { label: "Marge nette", value: `$${fmt(totals.netMargin)}`, icon: ArrowUpRight, color: totals.netMargin >= 0 ? "text-emerald-600" : "text-destructive", sub: `${totals.revenue > 0 ? ((totals.netMargin / totals.revenue) * 100).toFixed(1) : 0}%` },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon size={14} className={kpi.color} />
                <span className="text-[10px] text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-sm font-bold text-foreground">{kpi.value}</p>
              {kpi.sub && <p className="text-[10px] text-muted-foreground">{kpi.sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Parrainage", value: `−$${fmt(totals.referral)}`, icon: Users, color: "text-violet-600" },
            { label: "Fidélité", value: `−$${fmt(totals.loyalty)}`, icon: Gift, color: "text-pink-600" },
            { label: "Bonus vendeurs", value: `$${fmt(totals.vendorExtra)}`, icon: User2, color: "text-blue-600" },
            { label: "Commission indép.", value: `$${fmt(totals.commission)}`, icon: Percent, color: "text-primary" },
            { label: "Boutiques plateforme", value: String(totals.platformStores), icon: Building2, color: "text-primary" },
            { label: "Boutiques indép.", value: String(totals.independentStores), icon: Store, color: "text-amber-600" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon size={14} className={kpi.color} />
                <span className="text-[10px] text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-sm font-bold text-foreground">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Top 10 Chart with gross & net margins */}
        {top10Data.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Top 10 boutiques — CA vs Marges</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={top10Data}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip formatter={(v: number) => `$${fmt(v)}`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="CA" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Marge brute" fill="hsl(160, 60%, 40%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Marge nette" fill="hsl(40, 80%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Store Table */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Chargement des données...</span>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Boutique</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">CA</TableHead>
                    <TableHead className="text-right">Coût réel</TableHead>
                    <TableHead className="text-right">Passerelle</TableHead>
                    <TableHead className="text-right">Déductions</TableHead>
                    <TableHead className="text-right">Marge brute</TableHead>
                    <TableHead className="text-right">Marge nette</TableHead>
                    <TableHead className="text-right">Net dû</TableHead>
                    <TableHead className="text-right">Wallet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storeAccounting.map((store) => (
                    <>
                      <TableRow
                        key={store.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedStore(expandedStore === store.id ? null : store.id)}
                      >
                        <TableCell className="w-8">
                          {store.ordersCount > 0 && (
                            expandedStore === store.id
                              ? <ChevronDown size={14} className="text-muted-foreground" />
                              : <ChevronRight size={14} className="text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Store size={14} className="text-primary shrink-0" />
                            <span className="text-sm font-medium">{store.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={store.isPlatform ? "default" : "secondary"} className="text-[10px]">
                            {store.isPlatform ? "Plateforme" : `Indép. (${store.commissionRate}%)`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">${fmt(store.totalRevenue)}</TableCell>
                        <TableCell className="text-right text-sm">${fmt(store.totalCostReal)}</TableCell>
                        <TableCell className="text-right text-sm text-destructive">${fmt(store.totalGatewayFees)}</TableCell>
                        <TableCell className="text-right text-sm text-destructive">
                          ${fmt(store.totalReferralDeductions + store.totalLoyaltyDiscounts)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          ${fmt(store.grossMargin)}<MarginBadge pct={store.grossMarginPct} />
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold">
                          ${fmt(store.netMargin)}<MarginBadge pct={store.netMarginPct} />
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold">${fmt(store.netDueVendor)}</TableCell>
                        <TableCell className="text-right">
                          <div className="text-[10px]">
                            <span className="text-emerald-600 dark:text-emerald-400">${fmt(store.walletAvailable)}</span>
                            {" / "}
                            <span className="text-amber-600 dark:text-amber-400">${fmt(store.walletPending)}</span>
                          </div>
                        </TableCell>
                      </TableRow>

                      {expandedStore === store.id && (
                        <TableRow key={`${store.id}-details`}>
                          <TableCell colSpan={11} className="p-0">
                            <div className="bg-muted/30 px-4 py-3 space-y-4">
                              {/* Revenue by payment method with gateway fees */}
                              {Object.keys(store.revenueByMethod).length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Répartition par méthode — frais passerelle inclus</p>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(store.revenueByMethod).map(([method, amount]) => {
                                      const fee = (amount as number) * (getGatewayRate(method) / 100);
                                      return (
                                        <div key={method} className="px-2.5 py-1.5 bg-background border border-border rounded-md text-xs">
                                          <span className="text-muted-foreground">{methodLabel(method)}:</span>{" "}
                                          <span className="font-semibold">${fmt(amount as number)}</span>
                                          {fee > 0 && <span className="text-destructive ml-1">(−${fmt(fee)})</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Deductions breakdown */}
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Déductions détaillées</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  <div className="px-2.5 py-1.5 bg-background border border-border rounded-md text-xs">
                                    <span className="text-muted-foreground">Écart coût (calc−réel):</span>
                                    <span className="font-semibold ml-1">${fmt(store.totalCostSpread)}</span>
                                  </div>
                                  <div className="px-2.5 py-1.5 bg-background border border-border rounded-md text-xs">
                                    <span className="text-muted-foreground">Frais passerelle:</span>
                                    <span className="font-semibold text-destructive ml-1">−${fmt(store.totalGatewayFees)}</span>
                                  </div>
                                  <div className="px-2.5 py-1.5 bg-background border border-border rounded-md text-xs">
                                    <span className="text-muted-foreground">Parrainage:</span>
                                    <span className="font-semibold text-destructive ml-1">−${fmt(store.totalReferralDeductions)}</span>
                                  </div>
                                  <div className="px-2.5 py-1.5 bg-background border border-border rounded-md text-xs">
                                    <span className="text-muted-foreground">Fidélité:</span>
                                    <span className="font-semibold text-destructive ml-1">−${fmt(store.totalLoyaltyDiscounts)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Per-order financial breakdown */}
                              {store.orders.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                                    Détail par commande — {store.name} ({store.ordersCount} commandes)
                                  </p>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-border">
                                          <th className="text-left py-1 pr-3 w-6" />
                                          <th className="text-left py-1 pr-3">Commande</th>
                                          <th className="text-left py-1 px-2">Paiement</th>
                                          <th className="text-right py-1 px-2">CA</th>
                                          <th className="text-right py-1 px-2">Coût réel</th>
                                          <th className="text-right py-1 px-2">Passerelle</th>
                                          <th className="text-right py-1 px-2">Parrainage</th>
                                          <th className="text-right py-1 px-2">Fidélité</th>
                                          <th className="text-right py-1 px-2">M. brute</th>
                                          <th className="text-right py-1 px-2">M. nette</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {store.orders.map((o) => (
                                          <>
                                            <tr
                                              key={o.orderId}
                                              className="border-b border-border/50 cursor-pointer hover:bg-muted/40"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setExpandedOrder(expandedOrder === o.orderId ? null : o.orderId);
                                              }}
                                            >
                                              <td className="py-1 pr-1">
                                                {o.items.length > 0 && (
                                                  expandedOrder === o.orderId
                                                    ? <ChevronDown size={10} className="text-muted-foreground" />
                                                    : <ChevronRight size={10} className="text-muted-foreground" />
                                                )}
                                              </td>
                                              <td className="py-1 pr-3 font-medium text-primary">{o.orderRef}</td>
                                              <td className="py-1 px-2">
                                                <Badge variant="outline" className="text-[8px]">
                                                  {o.paymentMethod === "stripe" ? "Carte" : o.paymentMethod === "mobile_money" ? "MoMo" : o.paymentMethod === "cod" ? "COD" : o.paymentMethod === "off_platform" ? "Hors pl." : o.paymentMethod}
                                                </Badge>
                                              </td>
                                              <td className="text-right py-1 px-2 font-medium">${fmt(o.totalRevenue)}</td>
                                              <td className="text-right py-1 px-2">${fmt(o.totalCostReal)}</td>
                                              <td className="text-right py-1 px-2 text-destructive">
                                                {o.gatewayFeeAmount > 0 ? `−$${fmt(o.gatewayFeeAmount)}` : "—"}
                                              </td>
                                              <td className="text-right py-1 px-2 text-destructive">
                                                {o.referralDeduction > 0 ? `−$${fmt(o.referralDeduction)}` : "—"}
                                              </td>
                                              <td className="text-right py-1 px-2 text-destructive">
                                                {o.loyaltyDiscount > 0 ? `−$${fmt(o.loyaltyDiscount)}` : "—"}
                                              </td>
                                              <td className="text-right py-1 px-2">
                                                ${fmt(o.grossMargin)}
                                                <span className={`text-[8px] ml-0.5 ${o.grossMarginPct >= 15 ? "text-emerald-600" : o.grossMarginPct >= 0 ? "text-amber-600" : "text-destructive"}`}>
                                                  ({o.grossMarginPct.toFixed(0)}%)
                                                </span>
                                              </td>
                                              <td className="text-right py-1 px-2 font-semibold">
                                                ${fmt(o.netMargin)}
                                                <span className={`text-[8px] ml-0.5 ${o.netMarginPct >= 10 ? "text-emerald-600" : o.netMarginPct >= 0 ? "text-amber-600" : "text-destructive"}`}>
                                                  ({o.netMarginPct.toFixed(0)}%)
                                                </span>
                                              </td>
                                            </tr>
                                            {/* Expanded order items */}
                                            {expandedOrder === o.orderId && o.items.map((item, idx) => (
                                              <tr key={`${o.orderId}-item-${idx}`} className="bg-muted/20">
                                                <td />
                                                <td colSpan={2} className="py-0.5 pl-6 text-muted-foreground truncate max-w-[200px]">
                                                  {item.productName}
                                                </td>
                                                <td className="text-right py-0.5 px-2">${fmt(item.revenue)} <span className="text-[8px] text-muted-foreground">×{item.quantity}</span></td>
                                                <td className="text-right py-0.5 px-2">${fmt(item.costReal * item.quantity)}</td>
                                                <td colSpan={2} className="text-right py-0.5 px-2 text-muted-foreground">
                                                  calc: ${fmt(item.costCalc)} | écart: ${fmt(item.costCalc - item.costReal)}
                                                </td>
                                                <td />
                                                <td />
                                                <td className="text-right py-0.5 px-2">
                                                  {item.vendorExtra > 0 && <span className="text-blue-600">+${fmt(item.vendorExtra * item.quantity)}</span>}
                                                </td>
                                              </tr>
                                            ))}
                                          </>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                  {storeAccounting.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">
                        Aucune donnée pour cette période.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
