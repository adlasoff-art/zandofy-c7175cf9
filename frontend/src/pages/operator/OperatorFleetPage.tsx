/**
 * OperatorFleetPage — Lot 11B Phase B2
 *
 * Gestion des livreurs (riders) rattachés à l'opérateur.
 * Invitation par email + suspension/réactivation + demande quota.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOperatorContext } from "@/hooks/use-operator-context";
import { fromTable } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, Loader2, ShieldAlert, Trash2, Pause, Play, ArrowUpRight, Mail, Copy, X } from "lucide-react";

const VEHICLES = ["moto", "voiture", "tricycle", "camionnette"];
const MIN_RIDERS = 3;

export default function OperatorFleetPage() {
  const { operator, refetch } = useOperatorContext();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteVehicle, setInviteVehicle] = useState("moto");
  const [inviting, setInviting] = useState(false);

  // Quota form
  const [requestedQuota, setRequestedQuota] = useState(operator?.max_riders ?? 1);
  const [justification, setJustification] = useState("");
  const [requestingQuota, setRequestingQuota] = useState(false);

  const { data: riders = [], isLoading } = useQuery({
    queryKey: ["operator-fleet", operator?.id],
    enabled: !!operator?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await fromTable("delivery_operator_riders")
        .select("id, rider_user_id, vehicle_type, vehicle_plate, status, invited_at, activated_at")
        .eq("operator_id", operator!.id)
        .order("invited_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: invites = [] } = useQuery({
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
        console.warn("[fleet] invites fetch failed", error.message);
        return [];
      }
      return (data ?? []) as any[];
    },
  });

  const activeCount = riders.filter((r) => r.status === "active").length;
  const quotaReached = operator && activeCount >= operator.max_riders;
  const belowMinRiders = activeCount < MIN_RIDERS;

  const submitInvite = async () => {
    if (!inviteEmail.includes("@")) { toast.error("Email invalide"); return; }
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("operator-invite-rider", {
        body: {
          rider_email: inviteEmail.trim().toLowerCase(),
          full_name: inviteName.trim(),
          vehicle_type: inviteVehicle,
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
      setInviteEmail(""); setInviteName("");
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

  const copyInviteLink = (token: string, email: string) => {
    const url = `${window.location.origin}/rider-invite?token=${token}&email=${encodeURIComponent(email)}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Lien copié"),
      () => toast.error("Impossible de copier"),
    );
  };

  if (!operator) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Flotte</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount} actif{activeCount > 1 ? "s" : ""} / {operator.max_riders} (quota)
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={quotaOpen} onOpenChange={setQuotaOpen}>
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
          </Dialog>

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
          <Card key={r.id}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-foreground">{r.rider_user_id.slice(0, 8)}...</p>
                  <p className="text-xs text-muted-foreground">
                    {r.vehicle_type} · invité le {new Date(r.invited_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  {r.status === "active" && (
                    <Button size="icon" variant="ghost"
                      onClick={() => updateRiderStatus(r.id, "suspended")} title="Suspendre">
                      <Pause size={14} />
                    </Button>
                  )}
                  {r.status === "suspended" && (
                    <Button size="icon" variant="ghost"
                      onClick={() => updateRiderStatus(r.id, "active")} title="Réactiver">
                      <Play size={14} />
                    </Button>
                  )}
                  {r.status !== "revoked" && (
                    <Button size="icon" variant="ghost"
                      onClick={() => {
                        if (confirm("Retirer définitivement ce livreur de la flotte ?")) {
                          updateRiderStatus(r.id, "revoked");
                        }
                      }} title="Retirer">
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
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