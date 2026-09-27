import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Ship, Truck, TrendingUp, Bike } from "lucide-react";
import { PIE_COLORS, TOOLTIP_STYLE, KpiCardRow } from "./shared";
import type { PeriodKey } from "./DashboardPeriodSelector";
import { getPeriodDate } from "./DashboardPeriodSelector";
import type { GlobalFilters } from "./DashboardGlobalFilters";

interface Props { period: PeriodKey; geoFilters?: GlobalFilters; }

export function LogisticsTab({ period, geoFilters }: Props) {
  const sinceDate = getPeriodDate(period) ?? new Date(new Date().getFullYear() - 5, 0, 1);
  const since = sinceDate.toISOString();
  const sinceDay = format(sinceDate, "yyyy-MM-dd");
  const country = geoFilters?.country !== "all" ? geoFilters?.country : undefined;
  const city = geoFilters?.city !== "all" ? geoFilters?.city : undefined;

  const { data: deliveries = [] } = useQuery({
    queryKey: ["admin-log-deliveries", period, country, city],
    queryFn: async () => {
      let q = (supabase as any).from("deliveries").select("delivery_date, status, address, amount").gte("delivery_date", sinceDay);
      // Filter by address text if geo filters set
      if (city) q = q.ilike("address", `%${city}%`);
      else if (country) q = q.ilike("address", `%${country}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: shipments = [] } = useQuery({
    queryKey: ["admin-log-shipments", period],
    queryFn: async () => {
      // Hub shipper shipments (value column)
      const { data: hub } = await supabase
        .from("shipments")
        .select("mode, status, value, created_at")
        .gte("created_at", since);
      const hubRows = (hub || []).map((s: any) => ({
        mode: s.mode,
        status: s.status,
        value: Number(s.value || 0),
        created_at: s.created_at,
        source: "shipments" as const,
      }));

      // Marketplace forwarder assignments (quoted_price)
      const { data: assignments } = await (supabase as any)
        .from("shipment_assignments")
        .select("mode, status, quoted_price, created_at")
        .gte("created_at", since);
      const fwdRows = (assignments || []).map((s: any) => ({
        mode: s.mode || "air",
        status: s.status || "assigned",
        value: Number(s.quoted_price || 0),
        created_at: s.created_at,
        source: "assignment" as const,
      }));

      return [...hubRows, ...fwdRows];
    },
  });

  const { data: orderPipeline = [] } = useQuery({
    queryKey: ["admin-log-pipeline", period, country, city],
    queryFn: async () => {
      let q = (supabase as any).from("orders").select("status, shipping_country, shipping_city").gte("created_at", since);
      if (country) q = q.eq("shipping_country", country);
      if (city) q = q.eq("shipping_city", city);
      const { data } = await q;
      if (!data) return [];
      const map: Record<string, number> = {};
      data.forEach((o: any) => { map[o.status] = (map[o.status] || 0) + 1; });
      const pipelineLabels: Record<string, string> = {
        pending: "Reçue", confirmed: "Confirmée", preparing: "Préparation", in_shipping: "Expédition",
        shipped: "Hub", assigning_rider: "Assign.", rider_assigned: "Livreur", out_for_delivery: "Livraison", delivered: "Livrée",
      };
      const order = ["pending", "confirmed", "preparing", "in_shipping", "shipped", "assigning_rider", "rider_assigned", "out_for_delivery", "delivered"];
      return order.filter(s => map[s]).map(s => ({ name: pipelineLabels[s] || s, value: map[s] }));
    },
  });

  const delivered = deliveries.filter((d: any) => d.status === "delivered").length;
  const inProgress = deliveries.filter((d: any) => d.status === "in_progress").length;

  const dailyDeliveries = (() => {
    const days = eachDayOfInterval({ start: sinceDate, end: new Date() });
    const map: Record<string, { date: string; deliveredCount: number; deliveredAmount: number; pendingCount: number; pendingAmount: number; inProgressCount: number; inProgressAmount: number }> = {};
    days.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      map[key] = { date: format(d, days.length > 60 ? "d/MM" : "d MMM", { locale: fr }), deliveredCount: 0, deliveredAmount: 0, pendingCount: 0, pendingAmount: 0, inProgressCount: 0, inProgressAmount: 0 };
    });
    deliveries.forEach((d: any) => {
      if (map[d.delivery_date]) {
        const status = d.status === "delivered" ? "delivered" : d.status === "in_progress" ? "inProgress" : "pending";
        map[d.delivery_date][`${status}Count`]++;
        map[d.delivery_date][`${status}Amount`] += Number(d.amount || 0);
      }
    });
    return Object.values(map);
  })();

  const dailyShipments = (() => {
    const days = eachDayOfInterval({ start: sinceDate, end: new Date() });
    const map: Record<string, { date: string; deliveredCount: number; deliveredAmount: number; pendingCount: number; pendingAmount: number; inProgressCount: number; inProgressAmount: number }> = {};
    days.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      map[key] = { date: format(d, days.length > 60 ? "d/MM" : "d MMM", { locale: fr }), deliveredCount: 0, deliveredAmount: 0, pendingCount: 0, pendingAmount: 0, inProgressCount: 0, inProgressAmount: 0 };
    });
    shipments.forEach((shipment: any) => {
      const raw = shipment.created_at;
      const key = typeof raw === "string" && raw.length >= 10
        ? raw.slice(0, 10)
        : format(new Date(raw), "yyyy-MM-dd");
      if (!map[key]) return;
      const st = shipment.status || "";
      const status = st === "delivered"
        ? "delivered"
        : ["in_progress", "loading", "in_transit", "customs", "arrived", "picked_up"].includes(st)
          ? "inProgress"
          : "pending"; // assigned, pending, etc.
      map[key][`${status}Count`]++;
      map[key][`${status}Amount`] += Number(shipment.value || 0);
    });
    return Object.values(map);
  })();

  const modePie = (() => {
    const map: Record<string, number> = {};
    shipments.forEach((s) => { map[s.mode] = (map[s.mode] || 0) + 1; });
    const labels: Record<string, string> = { air: "Aérien", sea: "Maritime", road: "Routier" };
    return Object.entries(map).map(([name, value]) => ({ name: labels[name] || name, value }));
  })();

  const statusBar = (() => {
    const map: Record<string, number> = {};
    shipments.forEach((s) => { map[s.status] = (map[s.status] || 0) + 1; });
    const labels: Record<string, string> = { loading: "Chargement", in_transit: "En transit", customs: "Douanes", arrived: "Arrivé", delivered: "Livré" };
    return Object.entries(map).map(([name, value]) => ({ name: labels[name] || name, value }));
  })();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardRow icon={Ship} label="Expéditions" value={shipments.length.toString()} />
        <KpiCardRow icon={Truck} label="Livraisons totales" value={deliveries.length.toString()} />
        <KpiCardRow icon={TrendingUp} label="Livrées" value={delivered.toString()} />
        <KpiCardRow icon={Bike} label="En cours" value={inProgress.toString()} color="text-amber-500" />
      </div>

      {orderPipeline.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Pipeline des commandes (par étape)</h2>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orderPipeline} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="value" name="Commandes" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4">
        <StatusAmountChart title="Livraisons par jour — volume et montant" data={dailyDeliveries} />
      </div>

      {shipments.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <StatusAmountChart title="Expéditions par jour — volume et valeur" data={dailyShipments} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Expéditions par mode</h2>
          <div className="h-[250px]">
            {modePie.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Aucune expédition</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={modePie} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {modePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {statusBar.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4">Statuts des expéditions</h2>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusBar} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" name="Expéditions" fill="hsl(210, 70%, 50%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusAmountChart({ title, data }: { title: string; data: any[] }) {
  return (
    <>
      <h2 className="text-sm font-semibold text-foreground mb-4">{title}</h2>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(data.length / 15))} />
            <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 10 }} />
            <YAxis yAxisId="amount" orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number, name: string, item: any) => [
              String(item?.dataKey).endsWith("Amount") ? `$${Number(value).toLocaleString("fr-FR")}` : value,
              name,
            ]} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
            <Line yAxisId="count" dataKey="pendingCount" name="En attente (nb)" stroke="hsl(210, 70%, 50%)" dot={false} />
            <Line yAxisId="amount" dataKey="pendingAmount" name="En attente ($)" stroke="hsl(210, 70%, 50%)" strokeDasharray="4 3" dot={false} />
            <Line yAxisId="count" dataKey="inProgressCount" name="En cours (nb)" stroke="hsl(40, 80%, 50%)" dot={false} />
            <Line yAxisId="amount" dataKey="inProgressAmount" name="En cours ($)" stroke="hsl(40, 80%, 50%)" strokeDasharray="4 3" dot={false} />
            <Line yAxisId="count" dataKey="deliveredCount" name="Livrées (nb)" stroke="hsl(142, 70%, 40%)" dot={false} />
            <Line yAxisId="amount" dataKey="deliveredAmount" name="Livrées ($)" stroke="hsl(142, 70%, 40%)" strokeDasharray="4 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
