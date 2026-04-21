import { useEffect, useState } from "react";
import { Clock, CheckCircle2, XCircle, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { getSourcingColor } from "@/lib/sourcing-palette";

interface SourcingRequest {
  id: string;
  product_name: string | null;
  note: string | null;
  images: string[];
  status: "pending" | "answered" | "closed";
  created_at: string;
}

interface SourcingResponse {
  product_name: string;
  description: string | null;
  price: number | null;
  currency: string;
  min_quantity: number | null;
  colors: string[];
  image_url: string | null;
}

function useSignedUrls(paths: string[]) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    const sign = async () => {
      if (!paths.length) {
        setUrls([]);
        return;
      }
      const out: string[] = [];
      for (const p of paths) {
        if (!p) continue;
        if (p.startsWith("http")) {
          out.push(p);
          continue;
        }
        const { data } = await supabase.storage.from("sourcing-images").createSignedUrl(p, 3600);
        if (data?.signedUrl) out.push(data.signedUrl);
      }
      if (alive) setUrls(out);
    };
    sign();
    return () => {
      alive = false;
    };
  }, [paths.join("|")]);
  return urls;
}

const STATUS_META = {
  pending: { label: "En attente", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  answered: { label: "Réponse reçue", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  closed: { label: "Clôturée", icon: XCircle, className: "bg-muted text-muted-foreground border-border" },
} as const;

export function SourcingRequestCard({ request, response }: { request: SourcingRequest; response?: SourcingResponse | null }) {
  const meta = STATUS_META[request.status];
  const Icon = meta.icon;
  const reqUrls = useSignedUrls(request.images);
  const respUrls = useSignedUrls(response?.image_url ? [response.image_url] : []);

  return (
    <article className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {request.product_name || "Sans nom"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {new Date(request.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${meta.className}`}>
          <Icon size={12} />
          {meta.label}
        </span>
      </header>

      <div className="p-4 space-y-3">
        {request.note && <p className="text-sm text-foreground/80">{request.note}</p>}
        {reqUrls.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {reqUrls.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden bg-muted">
                <img src={u} alt="" className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        )}

        {response && (
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Notre proposition</p>
            <h4 className="text-sm font-semibold text-foreground">{response.product_name}</h4>
            {response.description && <p className="text-xs text-muted-foreground">{response.description}</p>}
            <div className="flex flex-wrap gap-2 text-xs">
              {response.price != null && (
                <Badge variant="secondary">
                  {response.currency} {response.price.toFixed(2)}
                </Badge>
              )}
              {response.min_quantity != null && <Badge variant="outline">Min : {response.min_quantity}</Badge>}
            </div>
            {response.colors?.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Couleurs :</span>
                {response.colors.map((k) => {
                  const c = getSourcingColor(k);
                  if (!c) return null;
                  return (
                    <span
                      key={k}
                      title={c.label}
                      className="inline-block w-4 h-4 rounded-full border border-border"
                      style={{ background: `hsl(${c.hsl})` }}
                    />
                  );
                })}
              </div>
            )}
            {respUrls[0] && (
              <a href={respUrls[0]} target="_blank" rel="noreferrer" className="block aspect-video rounded-lg overflow-hidden bg-muted">
                <img src={respUrls[0]} alt={response.product_name} className="w-full h-full object-cover" />
              </a>
            )}
          </div>
        )}

        {!response && request.status === "pending" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ImageIcon size={14} />
            Notre équipe traite votre demande sous 24-72h.
          </div>
        )}
      </div>
    </article>
  );
}