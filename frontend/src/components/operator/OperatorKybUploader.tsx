/**
 * OperatorKybUploader — Upload de documents légaux par un opérateur.
 * Utilise le bucket privé `operator-kyb-documents` + edge function metadata.
 */
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Upload, Loader2, ShieldCheck } from "lucide-react";

const DOC_TYPES = [
  { key: "rccm", label: "RCCM" },
  { key: "nif", label: "NIF / Tax ID" },
  { key: "id_card", label: "Pièce d'identité du dirigeant" },
  { key: "business_license", label: "Licence d'activité" },
  { key: "insurance", label: "Assurance" },
  { key: "other", label: "Autre" },
] as const;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];

type Doc = {
  id: string;
  doc_type: string;
  file_path: string;
  file_name: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  uploaded_at: string;
};

export function OperatorKybUploader({ operatorId }: { operatorId: string }) {
  const qc = useQueryClient();
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: docs } = useQuery({
    queryKey: ["operator-kyb-docs-self", operatorId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("operator_kyb_documents")
        .select("*")
        .eq("operator_id", operatorId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Doc[];
    },
  });

  const latestByType = (type: string) =>
    (docs || []).find((d) => d.doc_type === type) || null;

  const handleFile = async (docType: string, file: File) => {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Format non supporté (PDF, JPG, PNG uniquement)");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Fichier trop volumineux (max 10 MB)");
      return;
    }
    setUploadingType(docType);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${operatorId}/${docType}/${Date.now()}.${ext}`;
      const { error: upErr } = await (supabase as any).storage
        .from("operator-kyb-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data, error } = await supabase.functions.invoke("operator-upload-kyb-document", {
        body: {
          operator_id: operatorId,
          doc_type: docType,
          file_path: path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Document soumis");
      qc.invalidateQueries({ queryKey: ["operator-kyb-docs-self", operatorId] });
    } catch (e: any) {
      toast.error(e.message || "Erreur d'upload");
    } finally {
      setUploadingType(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck size={16} /> Documents légaux (KYB)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          PDF, JPG ou PNG · 10 MB max. Les documents sont stockés de manière privée et soumis à validation.
        </p>
        {DOC_TYPES.map((t) => {
          const cur = latestByType(t.key);
          const isUploading = uploadingType === t.key;
          const canReplace = !cur || cur.status === "rejected";
          return (
            <div key={t.key} className="border border-border rounded-md p-3 flex items-center gap-3">
              <FileText size={16} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t.label}</p>
                {cur ? (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {cur.file_name} · soumis {new Date(cur.uploaded_at).toLocaleDateString("fr-FR")}
                    {cur.status === "rejected" && cur.rejection_reason && (
                      <span className="text-destructive"> · refusé : {cur.rejection_reason}</span>
                    )}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Aucun document soumis</p>
                )}
              </div>
              {cur && (
                <Badge variant={cur.status === "approved" ? "secondary" : cur.status === "rejected" ? "destructive" : "default"}>
                  {cur.status === "pending" ? "En attente" : cur.status === "approved" ? "Approuvé" : "Refusé"}
                </Badge>
              )}
              <input
                ref={(el) => { inputs.current[t.key] = el; }}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(t.key, f);
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => inputs.current[t.key]?.click()}
                disabled={isUploading || !canReplace}
              >
                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} className="mr-1" />}
                {cur ? "Remplacer" : "Téléverser"}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}