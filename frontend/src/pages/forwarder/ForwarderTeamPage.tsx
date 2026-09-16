/**
 * ForwarderTeamPage — submit KYC member requests + manage approved staff passwords.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Users, KeyRound, FileUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useForwarderContext } from "@/hooks/use-forwarder-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  invited_email: string | null;
  created_at: string;
};

type RequestRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  role: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  member_id: string | null;
};

export default function ForwarderTeamPage() {
  const { forwarder, isOwner } = useForwarderContext();
  const qc = useQueryClient();
  const [draft, setDraft] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    job_title: "",
    role: "ops",
  });
  const [idFile, setIdFile] = useState<File | null>(null);
  const [pwdOpen, setPwdOpen] = useState<MemberRow | null>(null);
  const [password, setPassword] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [revealedPwd, setRevealedPwd] = useState<string | null>(null);

  const { data: seatCfg } = useQuery({
    queryKey: ["forwarder-saas-team-seats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "forwarder_saas")
        .maybeSingle();
      const seats = (data?.value as any)?.team_seats || {};
      return {
        mode: (seats.mode as string) || "free",
        included_seats: Number(seats.included_seats ?? 3),
        price_usd_per_seat_monthly: Number(seats.price_usd_per_seat_monthly ?? 9),
      };
    },
  });

  const { data: members = [], isLoading: memLoading } = useQuery({
    queryKey: ["forwarder-members", forwarder?.id],
    enabled: !!forwarder?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("forwarder_members")
        .select("id, user_id, role, is_active, invited_email, created_at")
        .eq("forwarder_id", forwarder!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as MemberRow[];
    },
  });

  const { data: requests = [], isLoading: reqLoading } = useQuery({
    queryKey: ["forwarder-member-requests", forwarder?.id],
    enabled: !!forwarder?.id && isOwner,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("forwarder_member_requests")
        .select("id, first_name, last_name, email, phone, job_title, role, status, admin_notes, created_at, member_id")
        .eq("forwarder_id", forwarder!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RequestRow[];
    },
  });

  const usedSeats = useMemo(() => {
    const active = members.length;
    const pending = requests.filter((r) => r.status === "pending").length;
    return active + pending;
  }, [members, requests]);

  const overIncluded = seatCfg ? usedSeats >= seatCfg.included_seats : false;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!forwarder?.id) throw new Error("Forwarder manquant");
      if (!draft.first_name.trim() || !draft.last_name.trim() || !draft.email.trim()) {
        throw new Error("Nom, prénom et email obligatoires");
      }
      if (!idFile) throw new Error("Pièce d'identité obligatoire (PDF/JPG/PNG)");

      const ext = idFile.name.split(".").pop()?.toLowerCase() || "pdf";
      const path = `${forwarder.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("forwarder-member-ids")
        .upload(path, idFile, { contentType: idFile.type, upsert: false });
      if (upErr) throw upErr;

      const { error } = await (supabase as any).from("forwarder_member_requests").insert({
        forwarder_id: forwarder.id,
        first_name: draft.first_name.trim(),
        last_name: draft.last_name.trim(),
        email: draft.email.trim().toLowerCase(),
        phone: draft.phone.trim() || null,
        job_title: draft.job_title.trim() || null,
        role: draft.role,
        id_document_path: path,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande soumise à l'admin Zandofy");
      setDraft({ first_name: "", last_name: "", email: "", phone: "", job_title: "", role: "ops" });
      setIdFile(null);
      qc.invalidateQueries({ queryKey: ["forwarder-member-requests", forwarder?.id] });
    },
    onError: (e: any) => toast.error(e.message || "Échec"),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("forwarder_member_requests")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande annulée");
      qc.invalidateQueries({ queryKey: ["forwarder-member-requests", forwarder?.id] });
    },
    onError: (e: any) => toast.error(e.message || "Échec"),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("forwarder_members")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membre désactivé");
      qc.invalidateQueries({ queryKey: ["forwarder-members", forwarder?.id] });
    },
    onError: (e: any) => toast.error(e.message || "Échec"),
  });

  const setPwdMutation = useMutation({
    mutationFn: async () => {
      if (!pwdOpen) throw new Error("Membre manquant");
      if (password.length < 8) throw new Error("Mot de passe min. 8 caractères");
      const { data, error } = await supabase.functions.invoke("forwarder-set-member-password", {
        body: {
          member_id: pwdOpen.id,
          password,
          notify_email: notifyEmail,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { password: string };
    },
    onSuccess: (data) => {
      setRevealedPwd(data.password);
      toast.success("Mot de passe défini — copiez-le maintenant");
    },
    onError: (e: any) => toast.error(e.message || "Échec"),
  });

  if (!forwarder) return null;

  if (!isOwner) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Seul le propriétaire peut gérer l&apos;équipe.
      </p>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <header className="flex items-center gap-3">
        <Users size={20} className="text-[hsl(var(--forwarder-primary))]" />
        <div>
          <h1 className="text-xl font-bold">Équipe</h1>
          <p className="text-xs text-muted-foreground">
            Soumettez une demande (identité + pièce). L&apos;admin Zandofy valide, puis vous définissez le mot de passe.
          </p>
        </div>
      </header>

      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Sièges utilisés : <strong className="text-foreground">{usedSeats}</strong>
        {seatCfg && (
          <>
            {" "}/ inclus {seatCfg.included_seats} · mode{" "}
            <strong className="text-foreground">{seatCfg.mode === "paid" ? "payant" : "gratuit"}</strong>
            {overIncluded && seatCfg.mode === "paid" && (
              <span className="text-amber-700">
                {" "}
                — au-delà : ~{seatCfg.price_usd_per_seat_monthly}$/mois/siège (facturation admin).
              </span>
            )}
          </>
        )}
      </div>

      <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Plus size={14} /> Nouvelle demande
        </h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Prénom *</Label>
            <Input value={draft.first_name} onChange={(e) => setDraft((d) => ({ ...d, first_name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nom *</Label>
            <Input value={draft.last_name} onChange={(e) => setDraft((d) => ({ ...d, last_name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Téléphone</Label>
            <Input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Poste</Label>
            <Input value={draft.job_title} onChange={(e) => setDraft((d) => ({ ...d, job_title: e.target.value }))} placeholder="Ex: Agent dédouanement" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rôle accès</Label>
            <Select value={draft.role} onValueChange={(v) => setDraft((d) => ({ ...d, role: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ops">Ops (TMS)</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs flex items-center gap-1"><FileUp size={12} /> Pièce d&apos;identité *</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setIdFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        <Button size="sm" disabled={submitMutation.isPending} onClick={() => submitMutation.mutate()} className="gap-1">
          {submitMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
          Soumettre à l&apos;admin
        </Button>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Demandes</h2>
        {reqLoading ? (
          <Loader2 className="animate-spin" />
        ) : requests.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune demande.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 border border-border rounded-md px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">
                    {r.first_name} {r.last_name}{" "}
                    <Badge variant="outline" className="text-[10px] ml-1">{r.status}</Badge>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.email} · {r.job_title || "—"} · {r.role}
                  </p>
                  {r.admin_notes && <p className="text-[11px] text-amber-700 mt-0.5">{r.admin_notes}</p>}
                </div>
                {r.status === "pending" && (
                  <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate(r.id)}>
                    Annuler
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Membres actifs</h2>
        {memLoading ? (
          <Loader2 className="animate-spin" />
        ) : members.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun membre actif.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 border border-border rounded-md px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{m.invited_email || m.user_id.slice(0, 8)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{m.role}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 h-8"
                    onClick={() => {
                      setPwdOpen(m);
                      setPassword("");
                      setRevealedPwd(null);
                    }}
                  >
                    <KeyRound size={12} /> Mot de passe
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => removeMutation.mutate(m.id)}>
                    <Trash2 size={14} className="text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!pwdOpen} onOpenChange={(o) => !o && setPwdOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Définir le mot de passe</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Affiché une seule fois ici. Communiquez-le à {pwdOpen?.invited_email}.
          </p>
          <div className="space-y-2">
            <Label className="text-xs">Mot de passe (min. 8)</Label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
              Notifier le collaborateur par email (sans envoyer le mot de passe)
            </label>
            {revealedPwd && (
              <p className="text-sm font-mono bg-muted rounded px-2 py-1 break-all">{revealedPwd}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(null)}>Fermer</Button>
            <Button disabled={setPwdMutation.isPending} onClick={() => setPwdMutation.mutate()}>
              {setPwdMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
