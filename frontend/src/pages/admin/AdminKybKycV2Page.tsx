import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useKybAdminQueue, getSignedKybUrl, adminDecideKyb, type KybStatus, type KybQueueItem } from "@/hooks/use-kyb-kyc-v2";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, ExternalLink, Loader2, Building2, FileText, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_TABS: { key: KybStatus | "all"; label: string }[] = [
  { key: "submitted", label: "À traiter" },
  { key: "in_review", label: "En revue" },
  { key: "approved", label: "Approuvés" },
  { key: "rejected", label: "Rejetés" },
  { key: "all", label: "Tous" },
];

export default function AdminKybKycV2Page() {
  const [tab, setTab] = useState<KybStatus | "all">("submitted");
  const { items, loading, refresh } = useKybAdminQueue(tab);
  const [selected, setSelected] = useState<KybQueueItem | null>(null);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-primary" size={22} />
          <h1 className="text-2xl font-bold">KYB / KYC v2 — Vérification vendeurs</h1>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            {STATUS_TABS.map(s => <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>)}
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
            ) : items.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun dossier dans cette catégorie.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {items.map(it => (
                  <Card key={it.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setSelected(it)}>
                    <CardContent className="py-3 px-4 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Building2 className="text-muted-foreground shrink-0" size={18} />
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{it.legal_name || it.store_name || "Sans nom"}</p>
                          <p className="text-xs text-muted-foreground truncate">RCCM: {it.rccm_number || "—"} · NIF: {it.tax_nif || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">Score {it.completeness_score ?? 0}%</Badge>
                        <Badge variant={it.status === "approved" ? "default" : it.status === "rejected" ? "destructive" : "secondary"}>{it.status}</Badge>
                        <span className="text-xs text-muted-foreground">{it.submitted_at ? format(new Date(it.submitted_at), "dd MMM yyyy", { locale: fr }) : "—"}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {selected && (
        <KybReviewDrawer
          submission={selected}
          onClose={() => setSelected(null)}
          onDone={async () => { setSelected(null); await refresh(); }}
        />
      )}
    </AdminLayout>
  );
}

function KybReviewDrawer({ submission, onClose, onDone }: { submission: KybQueueItem; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminScore, setAdminScore] = useState<number>(submission.admin_score ?? submission.completeness_score ?? 0);
  const [notes, setNotes] = useState<string>(submission.admin_notes ?? "");
  const [reason, setReason] = useState<string>(submission.rejection_reason ?? "");
  const [busy, setBusy] = useState(false);

  useState(() => {
    (async () => {
      const { data } = await (supabase as any).from("kyb_documents").select("*").eq("submission_id", submission.id);
      setDocs((data as any[]) || []);
      setLoading(false);
    })();
  });

  const open = async (path: string) => {
    const url = await getSignedKybUrl(path);
    if (url) window.open(url, "_blank");
  };

  const decide = async (decision: "approved" | "rejected" | "needs_changes") => {
    if (!user) return;
    if ((decision === "rejected" || decision === "needs_changes") && !reason.trim()) {
      toast({ title: "Motif requis", description: "Indiquez le motif avant de rejeter.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await adminDecideKyb(submission.id, decision, reason || null, adminScore || null, notes || null, user.id);
      toast({ title: "Décision enregistrée" });
      onDone();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Building2 size={20} /> {submission.legal_name || submission.store_name}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Informations entreprise</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Forme juridique</span><p className="font-medium">{submission.business_type || "—"}</p></div>
              <div><span className="text-muted-foreground">RCCM</span><p className="font-medium">{submission.rccm_number || "—"}</p></div>
              <div><span className="text-muted-foreground">NIF</span><p className="font-medium">{submission.tax_nif || "—"}</p></div>
              <div><span className="text-muted-foreground">Dirigeant</span><p className="font-medium">{submission.director_full_name || "—"}</p></div>
              <div><span className="text-muted-foreground">Pièce dirigeant</span><p className="font-medium">{submission.director_id_number || "—"}</p></div>
              <div><span className="text-muted-foreground">Pays / Ville</span><p className="font-medium">{submission.business_country} / {submission.business_city}</p></div>
              <div className="col-span-2"><span className="text-muted-foreground">Adresse</span><p className="font-medium">{submission.business_address || "—"}</p></div>
              <div><span className="text-muted-foreground">Banque</span><p className="font-medium">{submission.bank_name || "—"}</p></div>
              <div><span className="text-muted-foreground">Titulaire</span><p className="font-medium">{submission.bank_account_holder || "—"}</p></div>
              <div className="col-span-2"><span className="text-muted-foreground">N° compte</span><p className="font-medium">{submission.bank_account_number || "—"}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Documents</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {loading ? <Loader2 className="animate-spin" /> : docs.length === 0 ? <p className="text-sm text-muted-foreground">Aucun document.</p> : docs.map(d => (
                <div key={d.id} className="flex items-center justify-between border rounded-md p-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={16} className="shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.doc_type} — {d.file_name}</p>
                      <p className="text-xs text-muted-foreground">{(d.file_size / 1024).toFixed(0)} Ko · {d.mime_type}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => open(d.storage_path)}><ExternalLink size={14} className="mr-1" /> Ouvrir</Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Décision</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Score auto :</span>
                <Badge variant="secondary">{submission.completeness_score ?? 0}%</Badge>
              </div>
              <div>
                <Label>Score admin (0-100)</Label>
                <Input type="number" min={0} max={100} value={adminScore} onChange={e => setAdminScore(Number(e.target.value))} />
              </div>
              <div>
                <Label>Notes internes</Label>
                <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Visible admin uniquement" />
              </div>
              <div>
                <Label>Motif (rejet / modifications)</Label>
                <Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Visible par le vendeur" />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Button disabled={busy} variant="default" onClick={() => decide("approved")}><CheckCircle2 size={16} className="mr-1" /> Approuver</Button>
                <Button disabled={busy} variant="outline" onClick={() => decide("needs_changes")}><AlertTriangle size={16} className="mr-1" /> Modif.</Button>
                <Button disabled={busy} variant="destructive" onClick={() => decide("rejected")}><XCircle size={16} className="mr-1" /> Rejeter</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}