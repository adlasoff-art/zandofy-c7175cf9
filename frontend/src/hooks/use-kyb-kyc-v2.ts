import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export type KybStatus = "draft" | "submitted" | "in_review" | "approved" | "rejected" | "needs_changes";
export type KybDocType = "rccm" | "id_director" | "proof_address" | "tax_nif" | "bank_rib" | "other";
export type KybDocStatus = "pending" | "approved" | "rejected";

export interface KybSubmission {
  id: string;
  store_id: string;
  submitted_by: string;
  status: KybStatus;
  legal_name: string | null;
  business_type: string | null;
  rccm_number: string | null;
  tax_nif: string | null;
  director_full_name: string | null;
  director_id_number: string | null;
  business_address: string | null;
  business_country: string | null;
  business_city: string | null;
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
  completeness_score: number | null;
  admin_score: number | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KybDocument {
  id: string;
  submission_id: string;
  doc_type: KybDocType;
  storage_path: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  status: KybDocStatus;
  admin_notes: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export const KYB_REQUIRED_DOCS: { type: KybDocType; label: string; hint: string }[] = [
  { type: "rccm", label: "Registre du Commerce (RCCM)", hint: "Photo ou scan PDF du document officiel." },
  { type: "id_director", label: "Pièce d'identité du dirigeant", hint: "CNI, passeport ou permis de conduire." },
  { type: "proof_address", label: "Justificatif d'adresse", hint: "Facture < 3 mois (eau, électricité, bail)." },
  { type: "tax_nif", label: "Numéro d'Identification Fiscale (NIF)", hint: "Attestation officielle des impôts." },
  { type: "bank_rib", label: "Relevé bancaire / RIB", hint: "Pour le versement de vos paiements." },
];

export function useKybSubmission(storeId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submission, setSubmission] = useState<KybSubmission | null>(null);
  const [documents, setDocuments] = useState<KybDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!storeId || !user) return;
    setLoading(true);
    const { data: sub } = await (supabase as any)
      .from("kyb_submissions")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sub) {
      setSubmission(sub as KybSubmission);
      const { data: docs } = await (supabase as any)
        .from("kyb_documents")
        .select("*")
        .eq("submission_id", sub.id);
      setDocuments((docs as KybDocument[]) || []);
    } else {
      setSubmission(null);
      setDocuments([]);
    }
    setLoading(false);
  }, [storeId, user]);

  useEffect(() => { void load(); }, [load]);

  const ensureDraft = useCallback(async (): Promise<string | null> => {
    if (!storeId || !user) return null;
    if (submission && submission.status !== "approved") return submission.id;
    const { data, error } = await (supabase as any)
      .from("kyb_submissions")
      .insert({ store_id: storeId, submitted_by: user.id, status: "draft" })
      .select("id")
      .single();
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return null;
    }
    await load();
    return data.id;
  }, [storeId, user, submission, load, toast]);

  const updateFields = useCallback(async (patch: Partial<KybSubmission>) => {
    const id = await ensureDraft();
    if (!id) return;
    const { error } = await (supabase as any).from("kyb_submissions").update(patch).eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else await load();
  }, [ensureDraft, load, toast]);

  const uploadDocument = useCallback(async (docType: KybDocType, file: File) => {
    if (!user) return;
    const id = await ensureDraft();
    if (!id) return;
    const path = `${user.id}/${id}/${docType}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("kyb-documents").upload(path, file);
    if (upErr) { toast({ title: "Upload échoué", description: upErr.message, variant: "destructive" }); return; }
    const { error: insErr } = await (supabase as any).from("kyb_documents").insert({
      submission_id: id, doc_type: docType, storage_path: path,
      file_name: file.name, file_size: file.size, mime_type: file.type,
    });
    if (insErr) { toast({ title: "Erreur", description: insErr.message, variant: "destructive" }); return; }
    toast({ title: "Document ajouté" });
    await load();
  }, [user, ensureDraft, load, toast]);

  const deleteDocument = useCallback(async (docId: string, path: string) => {
    await supabase.storage.from("kyb-documents").remove([path]);
    await (supabase as any).from("kyb_documents").delete().eq("id", docId);
    await load();
  }, [load]);

  const submit = useCallback(async () => {
    if (!submission) return;
    const { error } = await (supabase as any).from("kyb_submissions")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", submission.id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Dossier soumis", description: "Votre dossier KYB est en attente de revue." }); await load(); }
  }, [submission, load, toast]);

  return { submission, documents, loading, updateFields, uploadDocument, deleteDocument, submit, refresh: load };
}

export interface KybQueueItem extends KybSubmission {
  store_name?: string | null;
  doc_count?: number;
}

export function useKybAdminQueue(statusFilter: KybStatus | "all" = "submitted") {
  const [items, setItems] = useState<KybQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("kyb_submissions").select("*, stores(name)").order("submitted_at", { ascending: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data } = await q;
    setItems(((data as any[]) || []).map(r => ({ ...r, store_name: r.stores?.name })));
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);
  return { items, loading, refresh: load };
}

export async function getSignedKybUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("kyb-documents").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export async function adminDecideKyb(
  submissionId: string,
  decision: "approved" | "rejected" | "needs_changes",
  reason: string | null,
  adminScore: number | null,
  notes: string | null,
  actorId: string,
) {
  const patch: any = {
    status: decision,
    rejection_reason: decision === "approved" ? null : reason,
    admin_score: adminScore,
    admin_notes: notes,
    reviewed_at: new Date().toISOString(),
    reviewed_by: actorId,
  };
  if (decision === "approved") patch.approved_at = new Date().toISOString();
  const { error } = await (supabase as any).from("kyb_submissions").update(patch).eq("id", submissionId);
  if (error) throw error;
  await (supabase as any).from("kyb_audit_log").insert({
    submission_type: "kyb",
    submission_id: submissionId,
    action: `admin_${decision}`,
    actor_id: actorId,
    new_value: { decision, reason, admin_score: adminScore },
    notes,
  });
}