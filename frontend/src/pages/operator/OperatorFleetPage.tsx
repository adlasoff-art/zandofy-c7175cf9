/**
 * OperatorFleetPage — Lot 11B Phase B2
 *
 * Gestion des livreurs (riders) rattachés à l'opérateur.
 * Invitation par email + suspension/réactivation + demande quota.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOperatorContext } from "@/hooks/use-operator-context";
import { useRoles } from "@/hooks/use-roles";
import { fromTable } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, Loader2, ShieldAlert, Trash2, Pause, Play, ArrowUpRight, Mail, Copy, X, RefreshCw, Phone, BellRing, CheckCircle2, AlertCircle, User as UserIcon, Package } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const VEHICLES = ["moto", "voiture", "tricycle", "camionnette"];
const MIN_RIDERS = 3;

export default function OperatorFleetPage() {
  const { operator, refetch } = useOperatorContext();
  const { isAdmin } = useRoles();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteVehicle, setInviteVehicle] = useState("moto");
  const [inviteOperatorId, setInviteOperatorId] = useState<string>("");
  const [inviting, setInviting] = useState(false);

  // Quota form
  const [requestedQuota, setRequestedQuota] = useState(operator?.max_riders ?? 1);
  const [justification, setJustification] = useState("");
  const [requestingQuota, setRequestingQuota] = useState(false);

  const { data: riders = [], isLoading, error: ridersError, refetch: refetchRiders } = useQuery({
    queryKey: ["operator-fleet", operator?.id],
    enabled: !!operator?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await fromTable("delivery_operator_riders")
        .select("id, rider_user_id, vehicle_type, vehicle_plate, status, invited_at, activated_at, last_kyc_reminder_at")
        .eq("operator_id", operator!.id)
        .order("invited_at", { ascending: false });
      if (error) {
        console.error("[fleet] riders fetch failed:", error);
        throw error;
      }
      return (data ?? []) as any[];
    },
  });

  // Profils des livreurs (identité)
  const riderUserIds = riders.map((r) => r.rider_user_id).filter(Boolean);
  const { data: profilesById = {} } = useQuery({
    queryKey: ["operator-fleet-profiles", operator?.id, riderUserIds.sort().join(",")],
    enabled: riderUserIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await fromTable("profiles")
        .select("id, first_name, last_name, email, phone, avatar_url")
        .in("id", riderUserIds);
      if (error) { console.warn("[fleet] profiles fetch failed:", error); return {}; }
      const map: Record<string, any> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
  });

  // Vue KYC par livreur
  const { data: kycById = {} } = useQuery({
    queryKey: ["operator-fleet-kyc", operator?.id],
    enabled: !!operator?.id && riderUserIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_riders_kyc_overview", { _operator_id: operator!.id });
      if (error) { console.warn("[fleet] kyc overview failed:", error); return {}; }
      const map: Record<string, any> = {};
      (data ?? []).forEach((row: any) => { map[row.rider_user_id] = row; });
      return map;
    },
  });

  // Stats activité 30j (actifs uniquement)
  const activeRiderIds = riders.filter((r) => r.status === "active").map((r) => r.rider_user_id);
  const { data: statsById = {} } = useQuery({
    queryKey: ["operator-fleet-stats", operator?.id, activeRiderIds.sort().join(",")],
    enabled: activeRiderIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data } = await fromTable("orders")
        .select("assigned_rider_id, status")
        .in("assigned_rider_id", activeRiderIds)
        .gte("created_at", since);
      const map: Record<string, { delivered: number; total: number }> = {};
      activeRiderIds.forEach((id) => { map[id] = { delivered: 0, total: 0 }; });
      (data ?? []).forEach((o: any) => {
        const m = map[o.assigned_rider_id];
        if (!m) return;
        m.total += 1;
        if (o.status === "delivered") m.delivered += 1;
      });
      return map;
    },
  });

  const { data: invites = [], error: invitesError, refetch: refetchInvites } = useQuery({
    queryKey: ["operator-fleet-invites", operator?.id],
    enabled: !!operator?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await fromTable("delivery_operator_rider_invites")
        .select("id, email, vehicle_type, status, invited_at, expires_at, token")
        .eq("operator_id", operator!.id)
        .eq("status", "pending")
        .order("invited_at", { ascending: false });
      if (error) {
        console.error("[fleet] invites fetch failed:", error);
        throw error;
      }
      return (data ?? []) as any[];
    },
  });

  // Liste des opérateurs visible uniquement par les admins (pour invite override)
  const { data: allOperators = [] } = useQuery({
    queryKey: ["all-delivery-operators-admin"],
    enabled: isAdmin,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await fromTable("delivery_operators")
        .select("id, company_name, status, is_active")
        .order("company_name", { ascending: true });
      if (error) return [];
      return (data ?? []) as Array<{ id: string; company_name: string; status: string; is_active: boolean }>;
    },
  });

  const activeCount = riders.filter((r) => r.status === "active").length;
  const quotaReached = operator && activeCount >= operator.max_riders;
  const belowMinRiders = activeCount < MIN_RIDERS;

  const handleRefresh = () => {
    refetchRiders();
    refetchInvites();
  };

  const submitInvite = async () => {
    if (!inviteEmail.includes("@")) { toast.error("Email invalide"); return; }
    const targetOperatorId = inviteOperatorId || operator?.id || null;
    if (!targetOperatorId) { toast.error("Sélectionnez un opérateur"); return; }
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("operator-invite-rider", {
        body: {
          rider_email: inviteEmail.trim().toLowerCase(),
          full_name: inviteName.trim(),
          vehicle_type: inviteVehicle,
          operator_id: targetOperatorId,
        },
      });
      if (error) {
        // Le SDK avale le body sur non-2xx : on lit error.context.json()
        let serverMsg = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            serverMsg = body?.error || body?.message || serverMsg;
            if (body?.auth_user_id) serverMsg += ` (uid: ${body.auth_user_id.slice(0, 8)}…)`;
          }
        } catch { /* ignore */ }
        throw new Error(serverMsg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const msg = (data as any)?.message || "Invitation envoyée";
      if ((data as any)?.email_sent === false) {
        toast.warning(msg);
      } else {
        toast.success(msg);
      }
      setInviteOpen(false);
      setInviteEmail(""); setInviteName(""); setInviteOperatorId("");
      queryClient.invalidateQueries({ queryKey: ["operator-fleet"] });
      queryClient.invalidateQueries({ queryKey: ["operator-fleet-invites"] });
    } catch (e: any) {
      toast.error(e.message || "Échec invitation");
    } finally {
      setInviting(false);
    }
  };

  const submitQuotaRequest = async () => {
    if (!operator) return;
    if (requestedQuota <= operator.max_riders) {
      toast.error("Le quota demandé doit être supérieur au quota actuel");
      return;
    }
    setRequestingQuota(true);
    try {
      const { error } = await supabase.functions.invoke("operator-request-quota-increase", {
        body: { requested_quota: requestedQuota, justification: justification.trim() },
      });
      if (error) throw new Error(error.message);
      toast.success("Demande envoyée à l'admin");
      setQuotaOpen(false);
      setJustification("");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Échec demande");
    } finally {
      setRequestingQuota(false);
    }
  };

  const updateRiderStatus = async (riderId: string, newStatus: "suspended" | "active" | "revoked") => {
    const { error } = await fromTable("delivery_operator_riders")
      .update({ status: newStatus, ...(newStatus === "revoked" ? { revoked_at: new Date().toISOString() } : {}) })
      .eq("id", riderId);
    if (error) toast.error(error.message);
    else {
      toast.success("Statut mis à jour");
      queryClient.invalidateQueries({ queryKey: ["operator-fleet"] });
    }
  };

  const cancelInvite = async (inviteId: string) => {
    if (!confirm("Annuler cette invitation ?")) return;
    const { error } = await fromTable("delivery_operator_rider_invites")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", inviteId);
    if (error) toast.error(error.message);
    else {
      toast.success("Invitation annulée");
      queryClient.invalidateQueries({ queryKey: ["operator-fleet-invites"] });
    }
  };

  const remindRiderKyc = async (riderId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("operator-remind-rider-kyc", {
        body: { rider_id: riderId },
      });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx?.json) {
            const b = await ctx.json();
            msg = b?.error || msg;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success((data as any)?.message || "Rappel envoyé");
      queryClient.invalidateQueries({ queryKey: ["operator-fleet"] });
    } catch (e: any) {
      toast.error(e.message || "Échec envoi rappel");
    }
  };

  const copyInviteLink = (token: string, email: string) => {
    const url = `${window.location.origin}/rider-invite?token=${token}&email=${encodeURIComponent(email)}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Lien copié"),
      () => toast.error("Impossible de copier"),
    );
  };

  if (!operator && !isAdmin) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Flotte</h1>
          {operator ? (
            <p className="text-sm text-muted-foreground">
              {activeCount} actif{activeCount > 1 ? "s" : ""} / {operator.max_riders} (quota)
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Mode admin — sélectionnez un opérateur dans la modale d'invitation</p>
          )}
        </div>
        <div className="flex gap-2">
          {operator && (
            <Button variant="outline" size="sm" onClick={handleRefresh} title="Rafraîchir la flotte">
              <RefreshCw size={14} />
            </Button>
          )}
          {operator && <Dialog open={quotaOpen} onOpenChange={setQuotaOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpRight size={14} /> Augmenter quota
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Demande d'augmentation de quota</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Quota actuel</Label>
                  <p className="text-sm font-medium">{operator.max_riders} livreur(s)</p>
                </div>
                <div>
                  <Label htmlFor="newq">Nouveau quota souhaité (max 30)</Label>
                  <Input id="newq" type="number" min={operator.max_riders + 1} max={30}
                    value={requestedQuota}
                    onChange={(e) => setRequestedQuota(parseInt(e.target.value) || operator.max_riders)} />
                </div>
                <div>
                  <Label htmlFor="just">Justification</Label>
                  <textarea id="just" value={justification} rows={3}
                    className="w-full rounded-md border border-input bg-background p-2 text-sm"
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Croissance volume, expansion ville..." />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submitQuotaRequest} disabled={requestingQuota}>
                  {requestingQuota ? <Loader2 className="animate-spin" size={14} /> : "Envoyer la demande"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>}

          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!!quotaReached}
                style={{ background: "var(--operator-gradient)" }} className="text-white">
                <UserPlus size={14} /> Inviter un livreur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Inviter un livreur</DialogTitle></DialogHeader>
              <div className="space-y-3">
                {isAdmin && (
                  <div>
                    <Label htmlFor="iop">Opérateur cible {operator ? "(défaut: votre opérateur)" : "*"}</Label>
                    <select id="iop" value={inviteOperatorId}
                      onChange={(e) => setInviteOperatorId(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">{operator ? `Mon opérateur (${operator.company_name})` : "— Choisir —"}</option>
                      {allOperators.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.company_name} {o.status !== "approved" || !o.is_active ? `(${o.status})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <Label htmlFor="iemail">Email du livreur *</Label>
                  <Input id="iemail" type="email" value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)} placeholder="livreur@example.com" />
                </div>
                <div>
                  <Label htmlFor="iname">Nom complet</Label>
                  <Input id="iname" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="ivehicle">Type de véhicule</Label>
                  <select id="ivehicle" value={inviteVehicle}
                    onChange={(e) => setInviteVehicle(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    {VEHICLES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Un email d'invitation sera envoyé. Le livreur devra valider son KYC avant activation.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={submitInvite} disabled={inviting}>
                  {inviting ? <Loader2 className="animate-spin" size={14} /> : "Envoyer l'invitation"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {quotaReached && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md">
          <ShieldAlert size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Quota maximum atteint. Demandez une augmentation pour inviter plus de livreurs.
          </p>
        </div>
      )}

      {!quotaReached && belowMinRiders && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md">
          <ShieldAlert size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Recommandation Zandofy : maintenez au moins {MIN_RIDERS} livreurs actifs pour assurer un taux d'acceptation élevé. Vous en avez actuellement <span className="font-semibold">{activeCount}</span>.
          </p>
        </div>
      )}

      {isLoading && <Loader2 className="animate-spin mx-auto my-8" size={24} />}
      {(ridersError || invitesError) && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
          <ShieldAlert size={14} className="text-destructive mt-0.5 shrink-0" />
          <div className="text-xs text-destructive space-y-1">
            <p className="font-semibold">Échec du chargement de la flotte (probablement RLS).</p>
            {ridersError && <p>Riders : {(ridersError as any)?.message || String(ridersError)}</p>}
            {invitesError && <p>Invitations : {(invitesError as any)?.message || String(invitesError)}</p>}
            <p className="opacity-80">Operator ID : <code>{operator?.id}</code></p>
          </div>
        </div>
      )}
      {!isLoading && riders.length === 0 && invites.length === 0 && (
        <Card><CardContent className="pt-8 text-center text-sm text-muted-foreground">
          Aucun livreur dans la flotte. Cliquez sur "Inviter un livreur" pour commencer.
        </CardContent></Card>
      )}

      {invites.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            Invitations en attente ({invites.length})
          </h2>
          {invites.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2">
                    <Mail size={14} className="text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.vehicle_type} · invité le {new Date(inv.invited_at).toLocaleDateString()} · expire le {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400">
                      En attente d'inscription
                    </span>
                    <Button size="icon" variant="ghost" title="Copier le lien d'invitation"
                      onClick={() => copyInviteLink(inv.token, inv.email)}>
                      <Copy size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" title="Annuler l'invitation"
                      onClick={() => cancelInvite(inv.id)}>
                      <X size={14} className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {riders.map((r) => (
          <RiderCard
            key={r.id}
            rider={r}
            profile={(profilesById as any)[r.rider_user_id]}
            kyc={(kycById as any)[r.rider_user_id]}
            stats={(statsById as any)[r.rider_user_id]}
            onSuspend={() => updateRiderStatus(r.id, "suspended")}
            onReactivate={() => updateRiderStatus(r.id, "active")}
            onRevoke={() => {
              if (confirm("Retirer définitivement ce livreur de la flotte ?")) {
                updateRiderStatus(r.id, "revoked");
              }
            }}
            onRemindKyc={() => remindRiderKyc(r.id)}
          />
        ))}
      </div>
    </div>
  );
}

function RiderCard({ rider, profile, kyc, stats, onSuspend, onReactivate, onRevoke, onRemindKyc }: {
  rider: any; profile?: any; kyc?: any; stats?: any;
  onSuspend: () => void; onReactivate: () => void; onRevoke: () => void; onRemindKyc: () => void;
}) {
  const fullName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() : "";
  const displayName = fullName || profile?.email || `Livreur ${rider.rider_user_id.slice(0, 8)}…`;
  const initials = (fullName || profile?.email || "??").split(/\s+/).map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const needsKyc = rider.status === "kyc_required" || rider.status === "pending";
  const reminderRecent = rider.last_kyc_reminder_at
    ? (Date.now() - new Date(rider.last_kyc_reminder_at).getTime()) < 24 * 3600 * 1000
    : false;
  const labelMap: Record<string, string> = {
    document_front: "Pièce d'identité (recto)",
    document_back: "Pièce d'identité (verso)",
    selfie: "Selfie",
  };

  return (
    <Card>
      <CardContent className="pt-3 pb-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Avatar className="h-10 w-10 shrink-0">
              {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={displayName} /> : null}
              <AvatarFallback className="text-xs">{initials || <UserIcon size={14} />}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {profile?.email && <span className="truncate">{profile.email}</span>}
                {profile?.phone && (
                  <a href={`tel:${profile.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                    <Phone size={11} /> {profile.phone}
                  </a>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {rider.vehicle_type}
                {rider.vehicle_plate ? ` · plaque ${rider.vehicle_plate}` : ""}
                {" · invité le "}{new Date(rider.invited_at).toLocaleDateString()}
                {rider.activated_at ? ` · actif depuis ${new Date(rider.activated_at).toLocaleDateString()}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <StatusBadge status={rider.status} />
            {rider.status === "active" && (
              <Button size="icon" variant="ghost" onClick={onSuspend} title="Suspendre"><Pause size={14} /></Button>
            )}
            {rider.status === "suspended" && (
              <Button size="icon" variant="ghost" onClick={onReactivate} title="Réactiver"><Play size={14} /></Button>
            )}
            {rider.status !== "revoked" && (
              <Button size="icon" variant="ghost" onClick={onRevoke} title="Retirer">
                <Trash2 size={14} className="text-destructive" />
              </Button>
            )}
          </div>
        </div>

        {needsKyc && (
          <div className="rounded-md border border-orange-200 dark:border-orange-900 bg-orange-50/60 dark:bg-orange-950/20 p-2.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-orange-800 dark:text-orange-300">
              <AlertCircle size={13} />
              KYC en attente {kyc?.kyc_status ? `(${kyc.kyc_status})` : ""}
            </div>
            {kyc?.missing_steps?.length ? (
              <ul className="text-xs text-orange-800/90 dark:text-orange-200/90 space-y-0.5 ml-5 list-disc">
                {kyc.missing_steps.map((s: string) => <li key={s}>{labelMap[s] ?? s}</li>)}
              </ul>
            ) : kyc?.kyc_status === "pending" ? (
              <p className="text-xs text-orange-800/90 dark:text-orange-200/90 ml-1">
                Pièces soumises, en attente de validation par l'équipe Zandofy.
              </p>
            ) : kyc?.kyc_status === "rejected" ? (
              <p className="text-xs text-destructive ml-1">
                Rejet : {kyc.rejection_reason || "raison non précisée"}
              </p>
            ) : (
              <p className="text-xs text-orange-800/90 dark:text-orange-200/90 ml-1">
                Le livreur n'a encore rien soumis.
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                disabled={reminderRecent || kyc?.kyc_status === "pending"}
                onClick={onRemindKyc}>
                <BellRing size={12} />
                {reminderRecent ? "Rappel envoyé (24 h)" : "Relancer par email"}
              </Button>
              {rider.last_kyc_reminder_at && (
                <span className="text-[10px] text-muted-foreground">
                  Dernier rappel : {new Date(rider.last_kyc_reminder_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        )}

        {rider.status === "active" && stats && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-2">
            <span className="inline-flex items-center gap-1">
              <Package size={12} />
              <span className="font-medium text-foreground">{stats.delivered}</span> livrées (30 j)
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 size={12} />
              {stats.total > 0
                ? `${Math.round((stats.delivered / stats.total) * 100)}% complétées`
                : "—"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "En attente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    kyc_required: { label: "KYC requis", cls: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
    active: { label: "Actif", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    suspended: { label: "Suspendu", cls: "bg-slate-500/15 text-slate-700 dark:text-slate-400" },
    revoked: { label: "Retiré", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-muted" };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}