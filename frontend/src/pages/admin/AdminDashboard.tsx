import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DashboardPeriodSelector, type PeriodKey } from "@/components/admin/dashboard/DashboardPeriodSelector";
import { OverviewTab } from "@/components/admin/dashboard/OverviewTab";
import { SalesTab } from "@/components/admin/dashboard/SalesTab";
import { LogisticsTab } from "@/components/admin/dashboard/LogisticsTab";
import { VendorsTab } from "@/components/admin/dashboard/VendorsTab";
import { ClientsTab } from "@/components/admin/dashboard/ClientsTab";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, BarChart3, Truck, Store, Users } from "lucide-react";

export default function AdminDashboard() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-order-stats"] });
        queryClient.invalidateQueries({ queryKey: ["admin-recent-orders"] });
        queryClient.invalidateQueries({ queryKey: ["admin-sales-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return (
    <AdminLayout title="Tableau de bord">
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
            <DashboardPeriodSelector value={period} onChange={setPeriod} />
          </div>

          <TabsContent value="overview"><OverviewTab period={period} /></TabsContent>
          <TabsContent value="sales"><SalesTab period={period} /></TabsContent>
          <TabsContent value="logistics"><LogisticsTab period={period} /></TabsContent>
          <TabsContent value="vendors"><VendorsTab period={period} /></TabsContent>
          <TabsContent value="clients"><ClientsTab period={period} /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
