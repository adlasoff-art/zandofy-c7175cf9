import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Eye, CheckCircle2, XCircle, RotateCcw, Loader2, FileText, User, Store, Clock,
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  submitted: { label: "En attente", variant: "default" },
  approved: { label: "Approuvée", variant: "default" },
  rejected: { label: "Refusée", variant: "destructive" },
  revision_requested: { label: "Révision demandée", variant: "outline" },
};

export default function AdminVendorApplicationsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const { data: applications, isLoading } = useQuery({
    queryKey: ["admin-vendor-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: selectedDocs } = useQuery({
    queryKey: ["admin-vendor-docs", selected?.id],
    queryFn: async () => {
      if (!selected) return [];
      const { data } = await supabase
        .from("vendor_documents")
        .select("*")
        .eq("application_id", selected.id);
      return data || [];
    },
    enabled: !!selected,
  });

  const sendVendorEmail = async (userId: string, subject: string, html: string) => {
    try {
      // Get vendor email from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single();

      if (!profile?.email) return;

      await supabase.functions.invoke("send-email", {
        body: { to: profile.email, subject, html },
      });
    } catch (err) {
      console.error("Email sending failed:", err);
    }
  };

  const handleAction = async (action: "approved" | "rejected" | "revision_requested") => {
    if (!selected) return;
    setActionLoading(true);

    const updates: any = {
      status: action,
      reviewed_at: new Date().toISOString(),
      admin_notes: adminNotes || null,
    };

    await supabase.from("vendor_applications").update(updates).eq("id", selected.id);

    // If approved, create store + assign vendor role
    if (action === "approved") {
      // Create the store
      await supabase.from("stores").insert({
        name: selected.store_name || "Nouvelle boutique",
        description: selected.store_description || null,
        logo_url: selected.store_logo_url || null,
        banner_url: selected.store_banner_url || null,
        owner_id: selected.user_id,
        is_verified: false,
      });

      // Assign vendor role
      await supabase.from("user_roles").insert({
        user_id: selected.user_id,
        role: "vendor",
      });

      // Notify user
      await supabase.from("notifications").insert({
        user_id: selected.user_id,
        type: "vendor",
        title: "Boutique approuvée !",
        message: "Félicitations ! Votre demande de vendeur a été approuvée. Accédez à votre espace vendeur.",
        link: "/vendor",
      });

      // Send approval email
      await sendVendorEmail(
        selected.user_id,
        "🎉 Votre boutique Zandofy a été approuvée !",
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h1 style="color:#16a34a;">Félicitations !</h1>
          <p>Bonjour <strong>${selected.full_name || "Vendeur"}</strong>,</p>
          <p>Votre demande de vendeur pour la boutique <strong>"${selected.store_name}"</strong> a été <span style="color:#16a34a;font-weight:bold;">approuvée</span>.</p>
          <p>Vous pouvez maintenant accéder à votre espace vendeur et commencer à ajouter vos produits.</p>
          <a href="${import.meta.env.VITE_SITE_URL || "https://zandofy.com"}/vendor" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">Accéder à ma boutique</a>
          <p style="color:#888;margin-top:24px;font-size:12px;">— L'équipe Zandofy</p>
        </div>`
      );
    } else if (action === "rejected") {
      await supabase.from("notifications").insert({
        user_id: selected.user_id,
        type: "vendor",
        title: "Demande refusée",
        message: adminNotes || "Votre demande de vendeur n'a pas été approuvée.",
        link: "/become-vendor",
      });

      // Send rejection email
      await sendVendorEmail(
        selected.user_id,
        "Mise à jour de votre demande vendeur Zandofy",
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h1 style="color:#dc2626;">Demande non approuvée</h1>
          <p>Bonjour <strong>${selected.full_name || "Vendeur"}</strong>,</p>
          <p>Votre demande de vendeur pour la boutique <strong>"${selected.store_name}"</strong> n'a malheureusement pas été approuvée.</p>
          ${adminNotes ? `<p><strong>Motif :</strong> ${adminNotes}</p>` : ""}
          <p>Vous pouvez soumettre une nouvelle demande à tout moment.</p>
          <a href="${import.meta.env.VITE_SITE_URL || "https://zandofy.com"}/become-vendor" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">Nouvelle demande</a>
          <p style="color:#888;margin-top:24px;font-size:12px;">— L'équipe Zandofy</p>
        </div>`
      );
    } else {
      await supabase.from("notifications").insert({
        user_id: selected.user_id,
        type: "vendor",
        title: "Révision demandée",
        message: adminNotes || "Veuillez corriger votre demande de vendeur.",
        link: "/become-vendor",
      });

      // Send revision email
      await sendVendorEmail(
        selected.user_id,
        "Révision demandée pour votre demande vendeur Zandofy",
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h1 style="color:#f59e0b;">Révision demandée</h1>
          <p>Bonjour <strong>${selected.full_name || "Vendeur"}</strong>,</p>
          <p>Votre demande de vendeur pour la boutique <strong>"${selected.store_name}"</strong> nécessite quelques modifications.</p>
          ${adminNotes ? `<p><strong>Commentaire :</strong> ${adminNotes}</p>` : ""}
          <p>Veuillez corriger les éléments mentionnés et resoumettre votre demande.</p>
          <a href="https://zandofy.lovable.app/become-vendor" style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">Corriger ma demande</a>
          <p style="color:#888;margin-top:24px;font-size:12px;">— L'équipe Zandofy</p>
        </div>`
      );
    }

    setActionLoading(false);
    setSelected(null);
    setAdminNotes("");
    queryClient.invalidateQueries({ queryKey: ["admin-vendor-applications"] });
    toast({ title: `Demande ${action === "approved" ? "approuvée" : action === "rejected" ? "refusée" : "renvoyée"}` });
  };

  const submitted = applications?.filter((a: any) => a.status === "submitted") || [];
  const others = applications?.filter((a: any) => a.status !== "submitted") || [];

  return (
    <AdminLayout title="Demandes Vendeur">
      <div className="space-y-6">
        {/* Pending applications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={18} className="text-amber-500" />
              En attente de validation ({submitted.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : submitted.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune demande en attente</p>
            ) : (
              <div className="space-y-3">
                {submitted.map((app: any) => (
                  <div key={app.id} className="flex items-center justify-between border border-border rounded-md p-3">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{app.full_name || "Sans nom"}</p>
                      <p className="text-xs text-muted-foreground">{app.store_name} · {app.business_type}</p>
                      <p className="text-xs text-muted-foreground">Soumis le {new Date(app.submitted_at || app.created_at).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setSelected(app)} className="gap-1.5">
                      <Eye size={14} /> Examiner
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All applications */}
        <Card>
          <CardHeader>
            <CardTitle>Historique ({others.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {others.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune demande</p>
            ) : (
              <div className="space-y-2">
                {others.map((app: any) => {
                  const st = STATUS_LABELS[app.status] || { label: app.status, variant: "secondary" as const };
                  return (
                    <div key={app.id} className="flex items-center justify-between border border-border rounded-md p-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium text-sm">{app.full_name || "Sans nom"}</p>
                          <p className="text-xs text-muted-foreground">{app.store_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={st.variant}>{st.label}</Badge>
                        <Button size="icon" variant="ghost" onClick={() => setSelected(app)} className="h-7 w-7">
                          <Eye size={14} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Review dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Examiner la demande</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              <div className="border border-border rounded-md p-3 space-y-1">
                <h4 className="font-semibold flex items-center gap-2"><User size={14} /> Informations</h4>
                <p><strong>Nom :</strong> {selected.full_name}</p>
                <p><strong>Téléphone :</strong> {selected.phone}</p>
                <p><strong>Activité :</strong> {selected.business_type}</p>
              </div>

              <div className="border border-border rounded-md p-3 space-y-1">
                <h4 className="font-semibold flex items-center gap-2"><Store size={14} /> Boutique</h4>
                <p><strong>Nom :</strong> {selected.store_name}</p>
                {selected.store_description && <p><strong>Description :</strong> {selected.store_description}</p>}
              </div>

              <div className="border border-border rounded-md p-3 space-y-1">
                <h4 className="font-semibold flex items-center gap-2"><FileText size={14} /> Documents KYB</h4>
                {selectedDocs && selectedDocs.length > 0 ? (
                  <ul className="space-y-2">
                    {selectedDocs.map((doc: any) => (
                      <li key={doc.id} className="flex items-center justify-between">
                        <span>{doc.document_type}: {doc.file_name}</span>
                        <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline">Voir</a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Aucun document</p>
                )}
              </div>

              {selected.status === "submitted" && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notes administrateur</label>
                    <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Raison du refus, demande de correction..." rows={3} />
                  </div>

                  <DialogFooter className="gap-2 flex-col sm:flex-row">
                    <Button variant="outline" onClick={() => handleAction("revision_requested")} disabled={actionLoading} className="gap-1.5">
                      <RotateCcw size={14} /> Demander révision
                    </Button>
                    <Button variant="destructive" onClick={() => handleAction("rejected")} disabled={actionLoading} className="gap-1.5">
                      <XCircle size={14} /> Refuser
                    </Button>
                    <Button onClick={() => handleAction("approved")} disabled={actionLoading} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                      {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Approuver
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
