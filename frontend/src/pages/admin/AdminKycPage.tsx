import { useState, useEffect, useCallback } from "react";
import { LocationHierarchyFilter, type LocationFilters } from "@/components/admin/LocationHierarchyFilter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { KycStatusBadge } from "@/components/kyc/KycStatusBadge";
import type { KycStatus } from "@/hooks/use-kyc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ShieldCheck, Search, Eye, CheckCircle, XCircle, RotateCcw,
  Loader2, ChevronLeft, FileImage, User, MapPin, Clock, Save,
  AlertTriangle, Link as LinkIcon,
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
  // Fetched separately
  profile?: { first_name: string | null; last_name: string | null; email: string | null } | null;
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

const KYC_REJECTION_REASONS = [
  { id: "blurry_doc", label: "Document illisible", description: "Le document est flou, coupé ou de mauvaise qualité." },
  { id: "blurry_selfie", label: "Selfie non conforme", description: "Le selfie est flou, le visage ou le document n'est pas clairement visible." },
  { id: "mismatch", label: "Informations incohérentes", description: "Les informations du document ne correspondent pas au profil." },
  { id: "expired_doc", label: "Document expiré", description: "Le document d'identité présenté est expiré." },
  { id: "wrong_doc_type", label: "Type de document non accepté", description: "Le type de document fourni n'est pas accepté pour la vérification." },
  { id: "incomplete", label: "Dossier incomplet", description: "Des éléments requis sont manquants (verso, selfie, adresse)." },
  { id: "fraud_suspicion", label: "Suspicion de fraude", description: "Le document semble altéré ou ne pas être authentique." },
  { id: "other", label: "Autre raison", description: "Raison personnalisée à préciser ci-dessous." },
] as const;

type KycReasonId = typeof KYC_REJECTION_REASONS[number]["id"];

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

  const [kycActivationOrders, setKycActivationOrders] = useState(2);
  const [kycOrderLimit, setKycOrderLimit] = useState(10);
  const [kycReminderDays, setKycReminderDays] = useState(7);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [frontUrl, setFrontUrl] = useState("");
  const [backUrl, setBackUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");

  // Rejection/revision dialog state
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"rejected" | "resubmission_required">("rejected");
  const [selectedReason, setSelectedReason] = useState<KycReasonId | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [policyLink, setPolicyLink] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("kyc_verifications")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter !== "all") {
      query = query.eq("status", filter);
    }
    const { data, error } = await query;
    if (error) {
      console.error("KYC fetch error:", error);
      setRows([]);
      setLoading(false);
      return;
    }
    const kycRows = (data as KycRow[]) || [];

    // Fetch profiles separately for all user_ids
    if (kycRows.length > 0) {
      const userIds = [...new Set(kycRows.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);
      
      const profileMap = new Map(
        (profiles || []).map(p => [p.id, { first_name: p.first_name, last_name: p.last_name, email: p.email }])
      );
      
      kycRows.forEach(r => {
        r.profile = profileMap.get(r.user_id) || null;
      });
    }

    setRows(kycRows);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

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
      value: { kyc_activation_orders: kycActivationOrders, kyc_order_limit: kycOrderLimit, kyc_reminder_days: kycReminderDays } as any,
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
    setAdminNotes(row.admin_notes || "");

    const { data } = await (supabase as any)
      .from("kyc_audit_logs")
      .select("*")
      .eq("kyc_id", row.id)
      .order("created_at", { ascending: false });
    setAuditLogs((data as AuditLog[]) || []);
  };

  const getSignedUrl = async (path: string) => {
    if (!path) return "";
    const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 3600);
    return data?.signedUrl || "";
  };

  useEffect(() => {
    if (!selected) return;
    (async () => {
      setFrontUrl(await getSignedUrl(selected.document_front_url));
      if (selected.document_back_url) setBackUrl(await getSignedUrl(selected.document_back_url));
      else setBackUrl("");
      setSelfieUrl(await getSignedUrl(selected.selfie_url));
    })();
  }, [selected]);

  const openActionDialog = (type: "rejected" | "resubmission_required") => {
    setActionType(type);
    setSelectedReason(null);
    setCustomReason("");
    setPolicyLink("");
    setActionDialogOpen(true);
  };

  const buildReasonText = () => {
    if (!selectedReason) return "";
    if (selectedReason === "other") return customReason.trim();
    const reasonObj = KYC_REJECTION_REASONS.find(r => r.id === selectedReason);
    const base = reasonObj ? `${reasonObj.label} — ${reasonObj.description}` : "";
    return customReason.trim() ? `${base}\n\n${customReason.trim()}` : base;
  };

  const handleAction = async (newStatus: KycStatus) => {
    if (!selected || !user) return;
    setActionLoading(true);
    try {
      const rejectionReason = (newStatus === "rejected" || newStatus === "resubmission_required")
        ? buildReasonText()
        : null;

      const fullReason = rejectionReason && policyLink.trim()
        ? `${rejectionReason}\n\n📎 Règlement : ${policyLink.trim()}`
        : rejectionReason;

      const { error } = await (supabase as any)
        .from("kyc_verifications")
        .update({
          status: newStatus,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: fullReason || null,
          admin_notes: adminNotes || null,
        })
        .eq("id", selected.id);
      if (error) throw error;

      await (supabase as any).from("kyc_audit_logs").insert({
        kyc_id: selected.id,
        action: newStatus === "approved" ? "approved" : newStatus === "rejected" ? "rejected" : "resubmission_requested",
        performed_by: user.id,
        old_status: selected.status,
        new_status: newStatus,
        notes: adminNotes || fullReason || null,
      });

      toast({ title: "Statut mis à jour", description: `KYC → ${newStatus === "approved" ? "Approuvé" : newStatus === "rejected" ? "Refusé" : "Révision demandée"}` });
      setSelected(null);
      setActionDialogOpen(false);
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
    const name = `${r.profile?.first_name || ""} ${r.profile?.last_name || ""}`.toLowerCase();
    const email = (r.profile?.email || "").toLowerCase();
    return name.includes(s) || email.includes(s) || r.id.includes(s);
  });

  const canSubmitAction = selectedReason && (selectedReason === "other" ? customReason.trim().length > 0 : true);

  // ── Detail view ──
  if (selected) {
    return (
      <AdminLayout title="Détail KYC">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-4">
          <ChevronLeft size={16} /> Retour à la liste
        </Button>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            {/* User info */}
            <div className="bg-card rounded-lg p-5 border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground flex items-center gap-2"><User size={16} /> Utilisateur</h3>
                <KycStatusBadge status={selected.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Nom</span><p className="font-medium text-foreground">{selected.profile?.first_name} {selected.profile?.last_name}</p></div>
                <div><span className="text-muted-foreground">Email</span><p className="font-medium text-foreground">{selected.profile?.email}</p></div>
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
                  {frontUrl ? (
                    <a href={frontUrl} target="_blank" rel="noopener noreferrer">
                      <img src={frontUrl} alt="Recto" className="w-full max-h-64 object-contain rounded-lg border border-border bg-muted cursor-pointer hover:opacity-90 transition-opacity" />
                    </a>
                  ) : (
                    <div className="h-32 flex items-center justify-center bg-muted rounded-lg border border-border">
                      <Loader2 size={20} className="animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                {selected.document_back_url && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Verso</p>
                    {backUrl ? (
                      <a href={backUrl} target="_blank" rel="noopener noreferrer">
                        <img src={backUrl} alt="Verso" className="w-full max-h-64 object-contain rounded-lg border border-border bg-muted cursor-pointer hover:opacity-90 transition-opacity" />
                      </a>
                    ) : (
                      <div className="h-32 flex items-center justify-center bg-muted rounded-lg border border-border">
                        <Loader2 size={20} className="animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Selfie avec document</p>
                  {selfieUrl ? (
                    <a href={selfieUrl} target="_blank" rel="noopener noreferrer">
                      <img src={selfieUrl} alt="Selfie" className="w-full max-h-64 object-contain rounded-lg border border-border bg-muted cursor-pointer hover:opacity-90 transition-opacity" />
                    </a>
                  ) : (
                    <div className="h-32 flex items-center justify-center bg-muted rounded-lg border border-border">
                      <Loader2 size={20} className="animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Actions */}
            {selected.status === "pending" || selected.status === "resubmission_required" ? (
              <div className="bg-card rounded-lg p-5 border border-border space-y-4">
                <h3 className="font-bold text-foreground">Actions de vérification</h3>

                <div className="space-y-2">
                  <Label className="text-xs">Notes admin (internes)</Label>
                  <Textarea
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                    rows={2}
                    placeholder="Notes internes visibles uniquement par l'équipe..."
                    className="text-sm"
                  />
                </div>

                <div className="flex gap-3">
                  <Button className="flex-1" onClick={() => handleAction("approved")} disabled={actionLoading}>
                    <CheckCircle size={16} className="mr-1" /> Approuver
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={() => openActionDialog("rejected")} disabled={actionLoading}>
                    <XCircle size={16} className="mr-1" /> Refuser
                  </Button>
                  <Button variant="outline" className="flex-1 text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20" onClick={() => openActionDialog("resubmission_required")} disabled={actionLoading}>
                    <RotateCcw size={16} className="mr-1" /> Révision
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-lg p-5 border border-border space-y-3">
                <h3 className="font-bold text-foreground">Statut actuel</h3>
                <KycStatusBadge status={selected.status} />
                {selected.rejection_reason && (
                  <div className="text-sm space-y-1">
                    <span className="text-muted-foreground">Raison :</span>
                    <p className="text-foreground whitespace-pre-wrap">{selected.rejection_reason}</p>
                  </div>
                )}
                {selected.admin_notes && (
                  <div className="text-sm space-y-1">
                    <span className="text-muted-foreground">Notes admin :</span>
                    <p className="text-foreground">{selected.admin_notes}</p>
                  </div>
                )}
                {selected.reviewed_at && (
                  <div className="text-sm text-muted-foreground">
                    Examiné le {format(new Date(selected.reviewed_at), "dd MMM yyyy HH:mm", { locale: fr })}
                  </div>
                )}
              </div>
            )}

            {/* Audit logs */}
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

        {/* Rejection / Revision Dialog */}
        <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {actionType === "rejected" ? (
                  <><XCircle size={16} className="text-destructive" /> Refuser la vérification KYC</>
                ) : (
                  <><RotateCcw size={16} className="text-orange-500" /> Renvoyer pour révision</>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Client : <strong className="text-foreground">{selected?.profile?.first_name} {selected?.profile?.last_name}</strong>
              </p>

              {/* Predefined reasons */}
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">
                  Raison {actionType === "rejected" ? "du refus" : "de la révision"}
                </Label>
                <div className="grid gap-1.5 max-h-48 overflow-y-auto">
                  {KYC_REJECTION_REASONS.map((reason) => (
                    <button
                      key={reason.id}
                      onClick={() => setSelectedReason(reason.id)}
                      className={`text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                        selectedReason === reason.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <span className="font-medium text-foreground">{reason.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{reason.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom details */}
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 block">
                  {selectedReason === "other" ? "Raison personnalisée *" : "Détails supplémentaires (optionnel)"}
                </Label>
                <Textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder={selectedReason === "other" ? "Décrivez la raison..." : "Ajoutez des précisions pour le client..."}
                  rows={3}
                  className="text-sm"
                />
              </div>

              {/* Policy link */}
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                  <LinkIcon size={12} />
                  Lien vers le règlement KYC (optionnel)
                </Label>
                <Input
                  type="url"
                  value={policyLink}
                  onChange={(e) => setPolicyLink(e.target.value)}
                  placeholder="https://zandofy.com/reglements/kyc"
                  className="text-sm"
                />
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-2.5">
                <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {actionType === "rejected"
                    ? "Le client sera notifié du refus avec la raison indiquée. Il devra resoumettre une nouvelle vérification."
                    : "Le client sera invité à corriger sa soumission et à la resoumettre pour vérification."
                  }
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setActionDialogOpen(false)} disabled={actionLoading}>
                Annuler
              </Button>
              <Button
                variant={actionType === "rejected" ? "destructive" : "default"}
                onClick={() => handleAction(actionType)}
                disabled={!canSubmitAction || actionLoading}
                className={actionType !== "rejected" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
              >
                {actionLoading ? "..." : actionType === "rejected" ? "Confirmer le refus" : "Renvoyer pour révision"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    );
  }

  // ── List view ──
  return (
    <AdminLayout title="Vérification KYC">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
                          <p className="font-medium text-foreground">{row.profile?.first_name} {row.profile?.last_name}</p>
                          <p className="text-xs text-muted-foreground">{row.profile?.email}</p>
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
