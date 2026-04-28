import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DashboardPeriodSelector, type PeriodKey } from "@/components/admin/dashboard/DashboardPeriodSelector";
import { DashboardGlobalFilters, type GlobalFilters } from "@/components/admin/dashboard/DashboardGlobalFilters";
import { OverviewTab } from "@/components/admin/dashboard/OverviewTab";
import { SalesTab } from "@/components/admin/dashboard/SalesTab";
import { OrdersTab } from "@/components/admin/dashboard/OrdersTab";
import { LogisticsTab } from "@/components/admin/dashboard/LogisticsTab";
import { VendorsTab } from "@/components/admin/dashboard/VendorsTab";
import { ClientsTab } from "@/components/admin/dashboard/ClientsTab";
import { SystemHealthWidget } from "@/components/admin/SystemHealthWidget";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, BarChart3, Truck, Store, Users, Receipt } from "lucide-react";

export default function AdminDashboard() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [geoFilters, setGeoFilters] = useState<GlobalFilters>({ country: "all", city: "all" });
  const queryClient = useQueryClient();

  // Polling for orders (15s) — Realtime removed for security
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["admin-order-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-recent-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-orders-detail"] });
    }, 15000);
    return () => clearInterval(interval);
  }, [queryClient]);

  // Polling for product/store counters (30s) — replaces removed Realtime channels
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-stats"] });
    }, 30000);
    return () => clearInterval(interval);
  }, [queryClient]);

  return (
    <AdminLayout title="Tableau de bord">
      <div className="mb-4">
        <SystemHealthWidget />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <Tabs defaultValue="overview" className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <TabsList className="bg-muted h-auto flex-wrap">
              <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
                <LayoutDashboard size={14} /> Vue d'ensemble
              </TabsTrigger>
              <TabsTrigger value="sales" className="gap-1.5 text-xs sm:text-sm">
                <BarChart3 size={14} /> Ventes
              </TabsTrigger>
              <TabsTrigger value="orders" className="gap-1.5 text-xs sm:text-sm">
                <Receipt size={14} /> Commandes
              </TabsTrigger>
              <TabsTrigger value="logistics" className="gap-1.5 text-xs sm:text-sm">
                <Truck size={14} /> Logistique
              </TabsTrigger>
              <TabsTrigger value="vendors" className="gap-1.5 text-xs sm:text-sm">
                <Store size={14} /> Vendeurs
              </TabsTrigger>
              <TabsTrigger value="clients" className="gap-1.5 text-xs sm:text-sm">
                <Users size={14} /> Clients & Parrainage
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-3 flex-wrap">
              <DashboardGlobalFilters value={geoFilters} onChange={setGeoFilters} />
              <DashboardPeriodSelector value={period} onChange={setPeriod} />
            </div>
          </div>

          <TabsContent value="overview"><OverviewTab period={period} geoFilters={geoFilters} /></TabsContent>
          <TabsContent value="sales"><SalesTab period={period} geoFilters={geoFilters} /></TabsContent>
          <TabsContent value="orders"><OrdersTab period={period} geoFilters={geoFilters} /></TabsContent>
          <TabsContent value="logistics"><LogisticsTab period={period} geoFilters={geoFilters} /></TabsContent>
          <TabsContent value="vendors"><VendorsTab period={period} geoFilters={geoFilters} /></TabsContent>
          <TabsContent value="clients"><ClientsTab period={period} geoFilters={geoFilters} /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
