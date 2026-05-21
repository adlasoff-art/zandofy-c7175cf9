import { useState, useRef } from "react";
import { useKybSubmission, KYB_REQUIRED_DOCS, getSignedKybUrl, type KybDocType } from "@/hooks/use-kyb-kyc-v2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, Upload, FileCheck, Trash2, ExternalLink, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props { storeId: string; }

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "outline" },
  submitted: { label: "Soumis — en attente", variant: "secondary" },
  in_review: { label: "En revue", variant: "secondary" },
  approved: { label: "Approuvé", variant: "default" },
  rejected: { label: "Rejeté", variant: "destructive" },
  needs_changes: { label: "Modifications requises", variant: "destructive" },
};

export function VendorKybV2Tab({ storeId }: Props) {
  const { submission, documents, loading, updateFields, uploadDocument, deleteDocument, submit } = useKybSubmission(storeId);
  const [uploading, setUploading] = useState<KybDocType | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const isLocked = submission?.status === "submitted" || submission?.status === "in_review" || submission?.status === "approved";
  const score = submission?.completeness_score ?? 0;
  const allDocsUploaded = KYB_REQUIRED_DOCS.every(d => documents.some(doc => doc.doc_type === d.type));

  const openDoc = async (path: string) => {
    const url = await getSignedKybUrl(path);
    if (url) window.open(url, "_blank");
  };

  const handleField = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
    void updateFields({ [field]: e.target.value } as any);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="text-primary" size={20} /> Vérification KYB (entreprise)</CardTitle>
            {submission && <Badge variant={STATUS_BADGE[submission.status].variant}>{STATUS_BADGE[submission.status].label}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {submission?.status === "rejected" && submission.rejection_reason && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription><strong>Motif de rejet :</strong> {submission.rejection_reason}</AlertDescription>
            </Alert>
          )}
          {submission?.status === "approved" && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>Votre dossier KYB a été approuvé. Toutes les fonctionnalités vendeur sont débloquées.</AlertDescription>
            </Alert>
          )}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Complétude du dossier</span>
              <span className="font-semibold">{score}%</span>
            </div>
            <Progress value={score} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Informations entreprise</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Raison sociale</Label><Input disabled={isLocked} defaultValue={submission?.legal_name ?? ""} onBlur={handleField("legal_name")} placeholder="SARL EXAMPLE" /></div>
          <div><Label>Forme juridique</Label><Input disabled={isLocked} defaultValue={submission?.business_type ?? ""} onBlur={handleField("business_type")} placeholder="SARL, SA, EI..." /></div>
          <div><Label>Numéro RCCM</Label><Input disabled={isLocked} defaultValue={submission?.rccm_number ?? ""} onBlur={handleField("rccm_number")} placeholder="CD/KIN/RCCM/..." /></div>
          <div><Label>NIF (n° impôt)</Label><Input disabled={isLocked} defaultValue={submission?.tax_nif ?? ""} onBlur={handleField("tax_nif")} /></div>
          <div><Label>Nom complet du dirigeant</Label><Input disabled={isLocked} defaultValue={submission?.director_full_name ?? ""} onBlur={handleField("director_full_name")} /></div>
          <div><Label>N° pièce d'identité du dirigeant</Label><Input disabled={isLocked} defaultValue={submission?.director_id_number ?? ""} onBlur={handleField("director_id_number")} /></div>
          <div className="md:col-span-2"><Label>Adresse de l'entreprise</Label><Input disabled={isLocked} defaultValue={submission?.business_address ?? ""} onBlur={handleField("business_address")} /></div>
          <div><Label>Pays</Label><Input disabled={isLocked} defaultValue={submission?.business_country ?? ""} onBlur={handleField("business_country")} placeholder="RDC" /></div>
          <div><Label>Ville</Label><Input disabled={isLocked} defaultValue={submission?.business_city ?? ""} onBlur={handleField("business_city")} /></div>
          <div><Label>Banque</Label><Input disabled={isLocked} defaultValue={submission?.bank_name ?? ""} onBlur={handleField("bank_name")} /></div>
          <div><Label>Titulaire du compte</Label><Input disabled={isLocked} defaultValue={submission?.bank_account_holder ?? ""} onBlur={handleField("bank_account_holder")} /></div>
          <div className="md:col-span-2"><Label>Numéro de compte / IBAN</Label><Input disabled={isLocked} defaultValue={submission?.bank_account_number ?? ""} onBlur={handleField("bank_account_number")} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Documents requis</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {KYB_REQUIRED_DOCS.map(req => {
            const uploaded = documents.find(d => d.doc_type === req.type);
            return (
              <div key={req.type} className="border rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    {uploaded ? <FileCheck className="text-primary" size={16} /> : <Upload className="text-muted-foreground" size={16} />}
                    <span className="font-semibold text-sm">{req.label}</span>
                    {uploaded && <Badge variant={uploaded.status === "approved" ? "default" : uploaded.status === "rejected" ? "destructive" : "secondary"}>{uploaded.status}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{req.hint}</p>
                  {uploaded && <p className="text-xs text-muted-foreground mt-1 truncate">📎 {uploaded.file_name}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {uploaded && <Button size="sm" variant="outline" onClick={() => openDoc(uploaded.storage_path)}><ExternalLink size={14} /></Button>}
                  {!isLocked && uploaded && <Button size="sm" variant="ghost" onClick={() => deleteDocument(uploaded.id, uploaded.storage_path)}><Trash2 size={14} /></Button>}
                  {!isLocked && (
                    <>
                      <input ref={el => (fileRefs.current[req.type] = el)} type="file" accept="image/*,application/pdf" hidden
                        onChange={async (e) => {
                          const f = e.target.files?.[0]; if (!f) return;
                          setUploading(req.type); await uploadDocument(req.type, f); setUploading(null);
                          if (fileRefs.current[req.type]) fileRefs.current[req.type]!.value = "";
                        }} />
                      <Button size="sm" disabled={uploading === req.type} onClick={() => fileRefs.current[req.type]?.click()}>
                        {uploading === req.type ? <Loader2 className="animate-spin" size={14} /> : uploaded ? "Remplacer" : "Uploader"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {!isLocked && (
        <div className="flex items-center justify-end gap-3">
          <span className="text-sm text-muted-foreground">{allDocsUploaded ? "Tous les documents sont fournis" : "Certains documents manquent"}</span>
          <Button disabled={!allDocsUploaded || score < 80} onClick={submit}>
            <ShieldCheck size={16} className="mr-2" /> Soumettre pour revue
          </Button>
        </div>
      )}
    </div>
  );
}