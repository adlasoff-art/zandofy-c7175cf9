import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Ship, Truck, TrendingUp, Bike } from "lucide-react";
import { PIE_COLORS, TOOLTIP_STYLE, KpiCardRow } from "./shared";
import type { PeriodKey } from "./DashboardPeriodSelector";
import { getPeriodDate } from "./DashboardPeriodSelector";

interface Props { period: PeriodKey; }

export function LogisticsTab({ period }: Props) {
  const sinceDate = getPeriodDate(period) ?? new Date(new Date().getFullYear() - 5, 0, 1);
  const since = sinceDate.toISOString();
  const sinceDay = format(sinceDate, "yyyy-MM-dd");

  // Deliveries
  const { data: deliveries = [] } = useQuery({
    queryKey: ["admin-log-deliveries", period],
    queryFn: async () => {
      const { data } = await supabase.from("deliveries").select("delivery_date, status").gte("delivery_date", sinceDay);
      return data ?? [];
    },
  });

  // Shipments
  const { data: shipments = [] } = useQuery({
    queryKey: ["admin-log-shipments", period],
    queryFn: async () => {
      const { data } = await supabase.from("shipments").select("mode, status").gte("created_at", since);
      return data ?? [];
    },
  });

  // Orders pipeline
  const { data: orderPipeline = [] } = useQuery({
    queryKey: ["admin-log-pipeline", period],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("status").gte("created_at", since);
      if (!data) return [];
      const map: Record<string, number> = {};
      data.forEach((o) => { map[o.status] = (map[o.status] || 0) + 1; });
      const pipelineLabels: Record<string, string> = {
        pending: "Reçue", confirmed: "Confirmée", preparing: "Préparation", in_shipping: "Expédition",
        shipped: "Hub", assigning_rider: "Assign.", rider_assigned: "Livreur", out_for_delivery: "Livraison", delivered: "Livrée",
      };
      const order = ["pending", "confirmed", "preparing", "in_shipping", "shipped", "assigning_rider", "rider_assigned", "out_for_delivery", "delivered"];
      return order.filter(s => map[s]).map(s => ({ name: pipelineLabels[s] || s, value: map[s] }));
    },
  });

  // KPIs
  const delivered = deliveries.filter(d => d.status === "delivered").length;
  const inProgress = deliveries.filter(d => d.status === "in_progress").length;
  const pending = deliveries.filter(d => d.status === "pending").length;

  // Daily delivery chart
  const dailyDeliveries = (() => {
    const days = eachDayOfInterval({ start: sinceDate, end: new Date() });
    const map: Record<string, { date: string; delivered: number; pending: number; inProgress: number }> = {};
    days.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      map[key] = { date: format(d, days.length > 60 ? "d/MM" : "d MMM", { locale: fr }), delivered: 0, pending: 0, inProgress: 0 };
    });
    deliveries.forEach((d) => {
      if (map[d.delivery_date]) {
        if (d.status === "delivered") map[d.delivery_date].delivered++;
        else if (d.status === "in_progress") map[d.delivery_date].inProgress++;
        else map[d.delivery_date].pending++;
      }
    });
    return Object.values(map);
  })();

  // Shipment mode pie
  const modePie = (() => {
    const map: Record<string, number> = {};
    shipments.forEach((s) => { map[s.mode] = (map[s.mode] || 0) + 1; });
    const labels: Record<string, string> = { air: "Aérien", sea: "Maritime", road: "Routier" };
    return Object.entries(map).map(([name, value]) => ({ name: labels[name] || name, value }));
  })();

  // Shipment status bar
  const statusBar = (() => {
    const map: Record<string, number> = {};
    shipments.forEach((s) => { map[s.status] = (map[s.status] || 0) + 1; });
    const labels: Record<string, string> = { loading: "Chargement", in_transit: "En transit", customs: "Douanes", arrived: "Arrivé", delivered: "Livré" };
    return Object.entries(map).map(([name, value]) => ({ name: labels[name] || name, value }));
  })();

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardRow icon={Ship} label="Expéditions" value={shipments.length.toString()} />
        <KpiCardRow icon={Truck} label="Livraisons totales" value={deliveries.length.toString()} />
        <KpiCardRow icon={TrendingUp} label="Livrées" value={delivered.toString()} />
        <KpiCardRow icon={Bike} label="En cours" value={inProgress.toString()} color="text-amber-500" />
      </div>

      {/* Pipeline */}
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

      {/* Daily deliveries */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Livraisons par jour</h2>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyDeliveries} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" interval={Math.max(0, Math.floor(dailyDeliveries.length / 15))} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="delivered" name="Livrées" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="inProgress" name="En cours" fill="hsl(40, 80%, 50%)" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="pending" name="En attente" fill="hsl(210, 70%, 50%)" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Shipment charts */}
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
