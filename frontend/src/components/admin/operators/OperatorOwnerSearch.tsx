/**
 * OperatorOwnerSearch — recherche sécurisée d'un propriétaire d'opérateur.
 *
 * - Aucune adresse e-mail n'est ni recherchée ni renvoyée au client.
 * - Recherche par prénom/nom uniquement (debounce 300ms, min 2 caractères).
 * - Affiche : nom complet · ville · "membre depuis" · badge KYC.
 * - Toggle explicite "Aucun propriétaire" (opérateur géré par la plateforme).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X, ShieldCheck, MapPin, CalendarDays } from "lucide-react";

export type OwnerProfile = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  city: string | null;
  is_kyc_verified: boolean | null;
  created_at: string | null;
};

type Props = {
  value: OwnerProfile | null;
  onChange: (v: OwnerProfile | null) => void;
  orphan: boolean;
  onOrphanChange: (v: boolean) => void;
};

const db = supabase as any;

export function OperatorOwnerSearch({ value, onChange, orphan, onOrphanChange }: Props) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<OwnerProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (orphan) { setResults([]); return; }
    const q = term.trim();
    if (q.length < 2) { setResults([]); return; }
    const handle = setTimeout(async () => {
      setLoading(true);
      // Recherche admin via RPC SECURITY DEFINER (email autorisé pour les admins)
      const { data, error } = await db.rpc("search_users_admin", { term: q });
      if (!error) setResults((data || []) as OwnerProfile[]);
      setLoading(false);
      setTouched(true);
    }, 300);
    return () => clearTimeout(handle);
  }, [term, orphan]);

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
    } catch { return "—"; }
  };

  const fullName = (p: OwnerProfile) =>
    [p.first_name, p.last_name].filter(Boolean).join(" ") || "(sans nom)";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div>
          <Label className="cursor-pointer">Aucun propriétaire</Label>
          <p className="text-xs text-muted-foreground">
            Opérateur géré directement par la plateforme (orphelin).
          </p>
        </div>
        <Switch
          checked={orphan}
          onCheckedChange={(v) => {
            onOrphanChange(v);
            if (v) { onChange(null); setResults([]); setTerm(""); }
          }}
        />
      </div>

      {!orphan && (
        <div className="space-y-2">
          <Label>Propriétaire (recherche par prénom ou nom)</Label>
          {value ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-border p-3 text-sm bg-muted/30">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-foreground">{fullName(value)}</span>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {value.city && <span className="inline-flex items-center gap-1"><MapPin size={11} />{value.city}</span>}
                  <span className="inline-flex items-center gap-1"><CalendarDays size={11} />Membre depuis {fmtDate(value.created_at)}</span>
                  {value.is_kyc_verified && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <ShieldCheck size={10} /> KYC vérifié
                    </Badge>
                  )}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => onChange(null)} aria-label="Retirer">
                <X size={14} />
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Nom, prénom ou email"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  autoComplete="off"
                />
                {loading && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {touched && !loading && term.trim().length >= 2 && results.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun utilisateur trouvé. Vérifiez le prénom ou le nom.
                </p>
              )}
              {results.length > 0 && (
                <div className="border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
                  {results.map((p) => (
                    <button
                      key={p.user_id}
                      type="button"
                      onClick={() => { onChange(p); setResults([]); setTerm(""); }}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-medium text-foreground truncate">{fullName(p)}</span>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {p.email && <span className="truncate">{p.email}</span>}
                          {p.city && <span>{p.city}</span>}
                          <span>· depuis {fmtDate(p.created_at)}</span>
                        </div>
                      </div>
                      {p.is_kyc_verified && (
                        <Badge variant="secondary" className="gap-1 text-[10px] shrink-0">
                          <ShieldCheck size={10} /> KYC
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Recherche admin (RPC sécurisée) — email visible pour faciliter l'identification.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}