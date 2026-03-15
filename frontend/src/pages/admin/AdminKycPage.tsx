import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KycStatusBadge } from "@/components/kyc/KycStatusBadge";
import type { KycStatus } from "@/hooks/use-kyc";
import {
  ShieldCheck, Search, Eye, CheckCircle, XCircle, RotateCcw,
  Loader2, ChevronLeft, FileImage, User, MapPin, Clock, Save,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface KycRow {
  id: string;
  user_id: string;
  status: KycStatus;
  document_type: string;
  document_front_url: string;
  document_back_url: string | null;
  selfie_url: string;
  address_country: string;
  address_city: string;
  address_street: string;
  address_district: string | null;
  address_postal_code: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { first_name: string | null; last_name: string | null; email: string | null } | null;
}

interface AuditLog {
  id: string;
  action: string;
  old_status: KycStatus | null;
  new_status: KycStatus | null;
  notes: string | null;
  created_at: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  national_id: "Carte d'identité",
  voter_card: "Carte d'électeur",
  passport: "Passeport",
  drivers_license: "Permis de conduire",
};

const STATUS_FILTERS = ["all", "pending", "approved", "rejected", "resubmission_required"] as const;

export default function AdminKycPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<KycRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<KycRow | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  // KYC Settings
  const [kycActivationOrders, setKycActivationOrders] = useState(2);
  const [kycOrderLimit, setKycOrderLimit] = useState(10);
  const [kycReminderDays, setKycReminderDays] = useState(7);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("kyc_verifications")
      .select("*, profiles!kyc_verifications_user_id_fkey(first_name, last_name, email)")
      .order("created_at", { ascending: false });
    if (filter !== "all") {
      query = query.eq("status", filter);
    }
    const { data } = await query;
    setRows((data as KycRow[]) || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Load KYC settings
  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "kyc_settings")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object") {
          const v = data.value as Record<string, number>;
          if (v.kyc_activation_orders) setKycActivationOrders(v.kyc_activation_orders);
          if (v.kyc_order_limit) setKycOrderLimit(v.kyc_order_limit);
          if (v.kyc_reminder_days) setKycReminderDays(v.kyc_reminder_days);
        }
      });
  }, []);

  const saveSettings = async () => {
    setSettingsLoading(true);
    const { error } = await supabase.from("platform_settings").upsert({
      key: "kyc_settings",
      value: { kyc_activation_orders: kycActivationOrders, kyc_order_limit: kycOrderLimit, kyc_reminder_days: kycReminderDays },
      updated_by: user?.id,
    }, { onConflict: "key" });
    setSettingsLoading(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Paramètres sauvegardés" });
    }
  };

  const openDetail = async (row: KycRow) => {
    setSelected(row);
    setRejectionReason(row.rejection_reason || "");
    setAdminNotes(row.admin_notes || "");

    const { data } = await supabase
      .from("kyc_audit_logs")
      .select("*")
      .eq("kyc_id", row.id)
      .order("created_at", { ascending: false });
    setAuditLogs((data as AuditLog[]) || []);
  };

  const getSignedUrl = async (path: string) => {
    const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 300);
    return data?.signedUrl || "";
  };

  const [frontUrl, setFrontUrl] = useState("");
  const [backUrl, setBackUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");

  useEffect(() => {
    if (!selected) return;
    (async () => {
      setFrontUrl(await getSignedUrl(selected.document_front_url));
      if (selected.document_back_url) setBackUrl(await getSignedUrl(selected.document_back_url));
      else setBackUrl("");
      setSelfieUrl(await getSignedUrl(selected.selfie_url));
    })();
  }, [selected]);

  const handleAction = async (newStatus: KycStatus) => {
    if (!selected || !user) return;
    if ((newStatus === "rejected" || newStatus === "resubmission_required") && !rejectionReason.trim()) {
      toast({ title: "Raison requise", description: "Veuillez indiquer la raison du rejet.", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("kyc_verifications")
        .update({
          status: newStatus,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: newStatus === "rejected" || newStatus === "resubmission_required" ? rejectionReason : null,
          admin_notes: adminNotes || null,
        })
        .eq("id", selected.id);
      if (error) throw error;

      await supabase.from("kyc_audit_logs").insert({
        kyc_id: selected.id,
        action: newStatus === "approved" ? "approved" : newStatus === "rejected" ? "rejected" : "resubmission_requested",
        performed_by: user.id,
        old_status: selected.status,
        new_status: newStatus,
        notes: adminNotes || rejectionReason || null,
      });

      toast({ title: "Statut mis à jour", description: `KYC → ${newStatus}` });
      setSelected(null);
      fetchRows();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    const name = `${r.profiles?.first_name || ""} ${r.profiles?.last_name || ""}`.toLowerCase();
    const email = (r.profiles?.email || "").toLowerCase();
    return name.includes(s) || email.includes(s) || r.id.includes(s);
  });

  // Detail view
  if (selected) {
    return (
      <AdminLayout title="Détail KYC" subtitle="Examen de la vérification d'identité">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-4">
          <ChevronLeft size={16} /> Retour à la liste
        </Button>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: User info + documents */}
          <div className="space-y-6">
            <div className="bg-card rounded-lg p-5 border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground flex items-center gap-2"><User size={16} /> Utilisateur</h3>
                <KycStatusBadge status={selected.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Nom</span><p className="font-medium text-foreground">{selected.profiles?.first_name} {selected.profiles?.last_name}</p></div>
                <div><span className="text-muted-foreground">Email</span><p className="font-medium text-foreground">{selected.profiles?.email}</p></div>
                <div><span className="text-muted-foreground">Document</span><p className="font-medium text-foreground">{DOC_TYPE_LABELS[selected.document_type] || selected.document_type}</p></div>
                <div><span className="text-muted-foreground">Soumis le</span><p className="font-medium text-foreground">{format(new Date(selected.created_at), "dd MMM yyyy HH:mm", { locale: fr })}</p></div>
              </div>
            </div>

            {/* Address */}
            <div className="bg-card rounded-lg p-5 border border-border space-y-3">
              <h3 className="font-bold text-foreground flex items-center gap-2"><MapPin size={16} /> Adresse déclarée</h3>
              <div className="text-sm space-y-1 text-foreground">
                <p>{selected.address_street}</p>
                {selected.address_district && <p>{selected.address_district}</p>}
                <p>{selected.address_city}, {selected.address_country}</p>
                {selected.address_postal_code && <p>CP: {selected.address_postal_code}</p>}
              </div>
            </div>

            {/* Documents */}
            <div className="bg-card rounded-lg p-5 border border-border space-y-4">
              <h3 className="font-bold text-foreground flex items-center gap-2"><FileImage size={16} /> Documents</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Recto</p>
                  {frontUrl && <img src={frontUrl} alt="Recto" className="w-full max-h-64 object-contain rounded-lg border border-border bg-muted" />}
                </div>
                {backUrl && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Verso</p>
                    <img src={backUrl} alt="Verso" className="w-full max-h-64 object-contain rounded-lg border border-border bg-muted" />
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Selfie avec document</p>
                  {selfieUrl && <img src={selfieUrl} alt="Selfie" className="w-full max-h-64 object-contain rounded-lg border border-border bg-muted" />}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Actions + Audit */}
          <div className="space-y-6">
            {selected.status === "pending" || selected.status === "resubmission_required" ? (
              <div className="bg-card rounded-lg p-5 border border-border space-y-4">
                <h3 className="font-bold text-foreground">Actions</h3>

                <div className="space-y-2">
                  <Label className="text-xs">Notes admin</Label>
                  <textarea
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground resize-none"
                    placeholder="Notes internes..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Raison du rejet (si applicable)</Label>
                  <textarea
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground resize-none"
                    placeholder="Document illisible, selfie flou..."
                  />
                </div>

                <div className="flex gap-3">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleAction("approved")} disabled={actionLoading}>
                    <CheckCircle size={16} className="mr-1" /> Approuver
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={() => handleAction("rejected")} disabled={actionLoading}>
                    <XCircle size={16} className="mr-1" /> Refuser
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => handleAction("resubmission_required")} disabled={actionLoading}>
                    <RotateCcw size={16} className="mr-1" /> Resoumettre
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-lg p-5 border border-border space-y-3">
                <h3 className="font-bold text-foreground">Statut actuel</h3>
                <KycStatusBadge status={selected.status} />
                {selected.rejection_reason && (
                  <div className="text-sm"><span className="text-muted-foreground">Raison : </span><span className="text-foreground">{selected.rejection_reason}</span></div>
                )}
                {selected.reviewed_at && (
                  <div className="text-sm text-muted-foreground">
                    Examiné le {format(new Date(selected.reviewed_at), "dd MMM yyyy HH:mm", { locale: fr })}
                  </div>
                )}
              </div>
            )}

            {/* Audit log */}
            <div className="bg-card rounded-lg p-5 border border-border space-y-3">
              <h3 className="font-bold text-foreground flex items-center gap-2"><Clock size={16} /> Historique</h3>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune action enregistrée.</p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map(log => (
                    <div key={log.id} className="text-sm border-l-2 border-border pl-3 py-1">
                      <p className="font-medium text-foreground capitalize">{log.action.replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.old_status} → {log.new_status} · {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                      </p>
                      {log.notes && <p className="text-xs text-muted-foreground italic">{log.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Vérification KYC" subtitle="Gestion des vérifications d'identité">
      <div className="space-y-6">
        {/* Settings toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="pl-9 w-64"
              />
            </div>
            <div className="flex gap-1">
              {STATUS_FILTERS.map(f => (
                <Button
                  key={f}
                  variant={filter === f ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter(f)}
                  className="text-xs capitalize"
                >
                  {f === "all" ? "Tous" : f === "pending" ? "En attente" : f === "approved" ? "Approuvés" : f === "rejected" ? "Refusés" : "À resoumettre"}
                </Button>
              ))}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
            ⚙️ Paramètres KYC
          </Button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="bg-card rounded-lg p-5 border border-border space-y-4">
            <h3 className="font-bold text-foreground">Paramètres KYC</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Commandes avant activation KYC</Label>
                <Input type="number" min={1} value={kycActivationOrders} onChange={e => setKycActivationOrders(Number(e.target.value))} />
                <p className="text-[10px] text-muted-foreground">Après X commandes, KYC est demandé</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Limite de commandes sans KYC</Label>
                <Input type="number" min={1} value={kycOrderLimit} onChange={e => setKycOrderLimit(Number(e.target.value))} />
                <p className="text-[10px] text-muted-foreground">Après X commandes, les commandes sont bloquées</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rappel tous les X jours</Label>
                <Input type="number" min={1} value={kycReminderDays} onChange={e => setKycReminderDays(Number(e.target.value))} />
                <p className="text-[10px] text-muted-foreground">Fréquence des rappels automatiques</p>
              </div>
            </div>
            <Button onClick={saveSettings} disabled={settingsLoading} size="sm">
              {settingsLoading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
              Sauvegarder
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <ShieldCheck size={32} className="mx-auto mb-2 opacity-40" />
              <p>Aucune vérification trouvée.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Utilisateur</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Document</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Statut</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(row => (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{row.profiles?.first_name} {row.profiles?.last_name}</p>
                          <p className="text-xs text-muted-foreground">{row.profiles?.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground">{DOC_TYPE_LABELS[row.document_type] || row.document_type}</td>
                      <td className="px-4 py-3"><KycStatusBadge status={row.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{format(new Date(row.created_at), "dd/MM/yyyy")}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(row)}>
                          <Eye size={14} className="mr-1" /> Examiner
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
