/**
 * AdminForwarderMemberRequests — validate team KYC requests.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";

type Row = {
  id: string;
  forwarder_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  role: string;
  id_document_path: string;
  status: string;
  created_at: string;
  forwarders?: { name: string } | null;
};

export function AdminForwarderMemberRequests() {
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-forwarder-member-requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("forwarder_member_requests")
        .select("id, forwarder_id, first_name, last_name, email, phone, job_title, role, id_document_path, status, created_at, forwarders:forwarder_id(name)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const openDoc = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("forwarder-member-ids")
      .createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast.error(error?.message || "Document inaccessible");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("admin-approve-forwarder-member", {
        body: { request_id: id, notes: notes[id] || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Membre approuvé — compte créé");
      qc.invalidateQueries({ queryKey: ["admin-forwarder-member-requests"] });
    },
    onError: (e: any) => toast.error(e.message || "Échec"),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("admin-reject-forwarder-member", {
        body: { request_id: id, notes: notes[id] || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Demande refusée");
      qc.invalidateQueries({ queryKey: ["admin-forwarder-member-requests"] });
    },
    onError: (e: any) => toast.error(e.message || "Échec"),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Aucune demande en attente.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="border border-border rounded-lg p-4 space-y-2 bg-card">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div>
              <p className="font-semibold text-sm">
                {r.first_name} {r.last_name}{" "}
                <Badge variant="outline" className="text-[10px]">{r.role}</Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                {(r.forwarders as any)?.name || r.forwarder_id.slice(0, 8)} · {r.email}
                {r.job_title ? ` · ${r.job_title}` : ""}
                {r.phone ? ` · ${r.phone}` : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => openDoc(r.id_document_path)}>
              <ExternalLink size={12} /> Pièce d&apos;identité
            </Button>
          </div>
          <Input
            placeholder="Notes admin (optionnel)"
            className="h-8 text-xs"
            value={notes[r.id] || ""}
            onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="gap-1"
              disabled={approve.isPending}
              onClick={() => approve.mutate(r.id)}
            >
              {approve.isPending ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              Approuver
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-destructive"
              disabled={reject.isPending}
              onClick={() => reject.mutate(r.id)}
            >
              <X size={14} /> Refuser
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
