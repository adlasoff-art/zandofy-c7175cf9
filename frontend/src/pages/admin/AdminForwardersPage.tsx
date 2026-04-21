import { AdminLayout } from "@/components/admin/AdminLayout";
import { ForwardersGlobalSettings } from "@/components/admin/forwarders/ForwardersGlobalSettings";
import { ForwardersList } from "@/components/admin/forwarders/ForwardersList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Settings } from "lucide-react";

export default function AdminForwardersPage() {
  return (
    <AdminLayout title="Transitaires">
      <div className="max-w-5xl mx-auto">
        <Tabs defaultValue="list" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="list" className="gap-2">
              <Truck size={14} /> Transitaires
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings size={14} /> Paramètres globaux
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <ForwardersList />
          </TabsContent>

          <TabsContent value="settings">
            <ForwardersGlobalSettings />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}