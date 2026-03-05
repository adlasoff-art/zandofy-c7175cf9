import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Coins, TrendingUp, Clock, XCircle, Search, Download, AlertTriangle, Mail } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const typeBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  earned: { label: "Crédité", variant: "default" },
  pending: { label: "En attente", variant: "secondary" },
  spent: { label: "Dépensé", variant: "outline" },
  voided: { label: "Annulé", variant: "destructive" },
  welcome: { label: "Bienvenue", variant: "default" },
  expired: { label: "Expiré", variant: "destructive" },
};

export default function AdminPointsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expiring, setExpiring] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["admin-point-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("point_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles-for-points"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, first_name, last_name");
      if (error) throw error;
      return data;
    },
  });

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const filtered = transactions.filter((t) => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (search) {
      const profile = profileMap[t.user_id];
      const name = profile ? `${profile.first_name || ""} ${profile.last_name || ""} ${profile.email || ""}`.toLowerCase() : "";
      if (!name.includes(search.toLowerCase()) && !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const totalEarned = transactions.filter((t) => t.type === "earned").reduce((s, t) => s + Number(t.amount), 0);
  const totalPending = transactions.filter((t) => t.type === "pending").reduce((s, t) => s + Number(t.amount), 0);
  const totalSpent = transactions.filter((t) => t.type === "spent").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const totalVoided = transactions.filter((t) => t.type === "voided").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  const exportCSV = () => {
    const header = "Date,Utilisateur,Email,Type,Montant,Description\n";
    const rows = filtered.map((t) => {
      const profile = profileMap[t.user_id];
      const name = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : t.user_id.slice(0, 8);
      const email = profile?.email || "";
      const date = format(new Date(t.created_at), "yyyy-MM-dd HH:mm");
      const desc = (t.description || "").replace(/"/g, '""');
      return `"${date}","${name}","${email}","${t.type}","${Number(t.amount).toFixed(2)}","${desc}"`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zandopoints-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Audit ZandoPoints">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold">Audit ZandoPoints</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={async () => {
              setNotifying(true);
              const { data, error } = await supabase.functions.invoke("notify-expiring-points");
              if (error) toast.error(error.message);
              else toast.success(`${data?.notified || 0} utilisateur(s) notifié(s), ${data?.emailsSent || 0} email(s) envoyé(s)`);
              setNotifying(false);
            }} disabled={notifying}>
              <Mail size={16} /> {notifying ? "..." : "Alerter points en risque"}
            </Button>
            <Button variant="outline" size="sm" onClick={async () => {
              setExpiring(true);
              const { data, error } = await supabase.rpc("expire_inactive_points", { months_limit: 12 });
              if (error) toast.error(error.message);
              else toast.success(`${data} compte(s) expirés`);
              setExpiring(false);
            }} disabled={expiring}>
              <AlertTriangle size={16} /> {expiring ? "..." : "Expirer points inactifs"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0}>
              <Download size={16} /> Exporter CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp size={16} className="text-green-500" /> Crédités
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-green-600">{totalEarned.toFixed(2)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock size={16} className="text-yellow-500" /> En attente
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-yellow-600">{totalPending.toFixed(2)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Coins size={16} className="text-blue-500" /> Dépensés
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-blue-600">{totalSpent.toFixed(2)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <XCircle size={16} className="text-red-500" /> Annulés
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-red-600">{totalVoided.toFixed(2)}</p></CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher par nom ou description..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="earned">Crédité</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="spent">Dépensé</SelectItem>
              <SelectItem value="voided">Annulé</SelectItem>
              <SelectItem value="welcome">Bienvenue</SelectItem>
              <SelectItem value="expired">Expiré</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune transaction</TableCell></TableRow>
                ) : (
                  filtered.map((t) => {
                    const profile = profileMap[t.user_id];
                    const badge = typeBadge[t.type] || { label: t.type, variant: "outline" as const };
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(t.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email : t.user_id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className={`text-right font-mono font-medium ${Number(t.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {Number(t.amount) >= 0 ? "+" : ""}{Number(t.amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{t.description}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
