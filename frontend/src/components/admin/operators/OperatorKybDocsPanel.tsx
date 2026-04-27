/**
 * OperatorKybDocsPanel — Onglet KYB documents pour le drawer admin.
 * Liste les documents soumis par l'opérateur, lien signé, approve/reject.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, FileText, CheckCircle2, XCircle, Eye } from "lucide-react";

type KybDoc = {
  id: string;
  doc_type: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  uploaded_at: string;
  verified_at: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  rccm: "RCCM",
  nif: "NIF / Tax ID",
  id_card: "Pièce d'identité",
  business_license: "Licence d'activité",
  insurance: "Assurance",
  other: "Autre",
};

export function OperatorKybDocsPanel({ operatorId }: { operatorId: string }) {
  const qc = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<KybDoc | null>(null);
  const [reason, setReason] = useState("");

  const { data: docs, isLoading } = useQuery({
    queryKey: ["operator-kyb-docs", operatorId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("operator_kyb_documents")
        .select("*")
        .eq("operator_id", operatorId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data || []) as KybDoc[];
    },
  });

  const review = useMutation({
    mutationFn: async ({ doc, decision, rejection_reason }: { doc: KybDoc; decision: "approved" | "rejected"; rejection_reason?: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-review-kyb-document", {
        body: { document_id: doc.id, decision, rejection_reason },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Document mis à jour");
      qc.invalidateQueries({ queryKey: ["operator-kyb-docs", operatorId] });
      setRejectTarget(null);
      setReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openSigned = async (doc: KybDoc) => {
    const { data, error } = await (supabase as any).storage
      .from("operator-kyb-documents")
      .createSignedUrl(doc.file_path, 300);
    if (error || !data?.signedUrl) {
      toast.error("Impossible de générer l'aperçu");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="animate-spin" /></div>;
  if (!docs || docs.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Aucun document soumis.</p>;
  }

  return (
    <div className="space-y-2">
      {docs.map((d) => (
        <div key={d.id} className="border border-border rounded-md p-3 flex items-center gap-3">
          <FileText size={16} className="text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {TYPE_LABEL[d.doc_type] || d.doc_type} — {d.file_name}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Soumis {new Date(d.uploaded_at).toLocaleDateString("fr-FR")}
              {d.size_bytes ? ` · ${(d.size_bytes / 1024).toFixed(0)} KB` : ""}
            </p>
            {d.status === "rejected" && d.rejection_reason && (
              <p className="text-[11px] text-destructive mt-1">Refusé : {d.rejection_reason}</p>
            )}
          </div>
          <Badge variant={d.status === "approved" ? "secondary" : d.status === "rejected" ? "destructive" : "default"}>
            {d.status === "pending" ? "En attente" : d.status === "approved" ? "Approuvé" : "Refusé"}
          </Badge>
          <Button size="sm" variant="ghost" onClick={() => openSigned(d)}>
            <Eye size={14} />
          </Button>
          {d.status === "pending" && (
            <>
              <Button size="sm" variant="default" onClick={() => review.mutate({ doc: d, decision: "approved" })} disabled={review.isPending}>
                <CheckCircle2 size={14} />
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setRejectTarget(d)}>
                <XCircle size={14} />
              </Button>
            </>
          )}
        </div>
      ))}

      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser le document</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Motif (obligatoire)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Document illisible, expiré, …" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setReason(""); }}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => rejectTarget && reason.trim().length >= 3 && review.mutate({ doc: rejectTarget, decision: "rejected", rejection_reason: reason.trim() })}
              disabled={review.isPending || reason.trim().length < 3}
            >
              {review.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
              Refuser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}