import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, MessageSquareReply, Loader2, PackageSearch, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SourcingResponseDialog } from "@/components/admin/sourcing/SourcingResponseDialog";
import { SourcingCleanupDialog } from "@/components/admin/sourcing/SourcingCleanupDialog";

interface Row {
  id: string;
  user_id: string;
  product_name: string | null;
  note: string | null;
  images: string[];
  status: "pending" | "answered" | "closed";
  created_at: string;
  product_sourcing_responses?: any;
  profiles?: { email: string | null; first_name: string | null; last_name: string | null } | null;
}

function useSignedUrls(paths: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    const work = async () => {
      const out: Record<string, string> = {};
      for (const p of paths) {
        if (!p || p.startsWith("http")) {
          if (p) out[p] = p;
          continue;
        }
        const { data } = await supabase.storage.from("sourcing-images").createSignedUrl(p, 3600);
        if (data?.signedUrl) out[p] = data.signedUrl;
      }
      if (alive) setUrls(out);
    };
    work();
    return () => { alive = false; };
  }, [paths.join("|")]);
  return urls;
}

export default function AdminProductSourcingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [responseTarget, setResponseTarget] = useState<Row | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("product_sourcing_requests" as any)
      .select("id, user_id, product_name, note, images, status, created_at, product_sourcing_responses(id, product_name, description, price, currency, min_quantity, colors, image_url), profiles(email, first_name, last_name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (status !== "all") query = query.eq("status", status);
    const { data } = await query;
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [status]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (r.product_name || "").toLowerCase().includes(q) ||
        (r.note || "").toLowerCase().includes(q) ||
        (r.profiles?.email || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const allImagePaths = useMemo(() => filtered.flatMap((r) => r.images ?? []), [filtered]);
  const urlMap = useSignedUrls(allImagePaths);

  return (
    <AdminLayout title="Demandes de sourcing">
      <div className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <PackageSearch size={22} className="text-primary" />
              Demandes de sourcing
            </h1>
            <p className="text-sm text-muted-foreground">Recherches produit envoyées par les clients.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setCleanupOpen(true)}>
              <Trash2 size={16} className="mr-2" />
              Nettoyer
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher (nom, note, email client)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]">
              <Filter size={14} className="mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="answered">Répondues</SelectItem>
              <SelectItem value="closed">Clôturées</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground rounded-xl border border-border bg-card">
            Aucune demande pour les filtres sélectionnés.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const resp = Array.isArray(r.product_sourcing_responses)
                ? r.product_sourcing_responses[0]
                : r.product_sourcing_responses;
              return (
                <article key={r.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">
                          {r.product_name || "Sans nom"}
                        </h3>
                        <Badge variant={r.status === "answered" ? "default" : r.status === "pending" ? "secondary" : "outline"}>
                          {r.status === "pending" ? "En attente" : r.status === "answered" ? "Répondu" : "Clôturé"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {r.profiles?.email ?? r.user_id} ·{" "}
                        {new Date(r.created_at).toLocaleString("fr-FR")}
                      </p>
                      {r.note && <p className="mt-2 text-sm text-foreground/80">{r.note}</p>}
                    </div>
                    <Button size="sm" onClick={() => setResponseTarget(r)}>
                      <MessageSquareReply size={14} className="mr-2" />
                      {resp ? "Modifier la réponse" : "Répondre"}
                    </Button>
                  </div>

                  {r.images?.length > 0 && (
                    <div className="mt-3 flex gap-2">
                      {r.images.map((p) =>
                        urlMap[p] ? (
                          <a key={p} href={urlMap[p]} target="_blank" rel="noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden bg-muted border border-border">
                            <img src={urlMap[p]} alt="" className="w-full h-full object-cover" />
                          </a>
                        ) : (
                          <div key={p} className="w-20 h-20 rounded-lg bg-muted animate-pulse" />
                        ),
                      )}
                    </div>
                  )}

                  {resp && (
                    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/80">
                      <span className="font-semibold text-primary">Réponse :</span> {resp.product_name}
                      {resp.price != null && ` — ${resp.currency} ${Number(resp.price).toFixed(2)}`}
                      {resp.min_quantity != null && ` · MOQ ${resp.min_quantity}`}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <SourcingResponseDialog
        open={!!responseTarget}
        onOpenChange={(v) => !v && setResponseTarget(null)}
        request={responseTarget}
        existing={
          responseTarget &&
          (Array.isArray(responseTarget.product_sourcing_responses)
            ? responseTarget.product_sourcing_responses[0]
            : responseTarget.product_sourcing_responses)
        }
        onSaved={load}
      />

      <SourcingCleanupDialog open={cleanupOpen} onOpenChange={setCleanupOpen} onCleaned={load} />
    </AdminLayout>
  );
}