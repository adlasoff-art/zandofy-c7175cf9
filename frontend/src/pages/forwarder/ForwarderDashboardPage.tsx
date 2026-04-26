import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Package, MapPin, FileText, AlertCircle, CheckCircle2, Clock, Ban, ExternalLink } from "lucide-react";

type ForwarderRow = {
  id: string;
  company_name: string;
  legal_name: string | null;
  status: string;
  rejection_reason: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  headquarters_city: string | null;
  headquarters_country: string | null;
  supported_modes: string[] | null;
  coverage_routes: any;
  documents: any;
  submitted_at: string | null;
  approved_at: string | null;
};

const STATUS_META: Record<string, { label: string; icon: any; tone: string }> = {
  pending: { label: "En cours d'examen", icon: Clock, tone: "text-amber-500" },
  approved: { label: "Approuvé", icon: CheckCircle2, tone: "text-emerald-500" },
  rejected: { label: "Refusé", icon: Ban, tone: "text-destructive" },
  suspended: { label: "Suspendu", icon: AlertCircle, tone: "text-destructive" },
};

export default function ForwarderDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [forwarder, setForwarder] = useState<ForwarderRow | null>(null);
  const [signedDocs, setSignedDocs] = useState<{ name: string; url: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("forwarders")
        .select("*")
        .eq("owner_user_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) console.warn("[ForwarderDashboard]", error.message);
      setForwarder(data || null);

      // Signer les URLs des documents
      const docs = Array.isArray(data?.documents) ? data.documents : [];
      const signed: { name: string; url: string }[] = [];
      for (const doc of docs) {
        const path = typeof doc === "string" ? doc : doc?.path;
        const name = typeof doc === "string" ? doc.split("/").pop() : (doc?.name || doc?.path?.split("/").pop());
        if (!path) continue;
        const { data: signedData } = await supabase.storage
          .from("forwarder-documents")
          .createSignedUrl(path, 3600);
        if (signedData?.signedUrl) signed.push({ name: name || "document", url: signedData.signedUrl });
      }
      setSignedDocs(signed);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!forwarder) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4">
        <Package size={48} className="text-muted-foreground" />
        <h1 className="text-lg font-bold text-foreground">Aucun dossier transitaire</h1>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Vous n'avez pas encore soumis de candidature transitaire. Démarrez votre dossier KYB.
        </p>
        <Button asChild>
          <Link to="/become-forwarder">Devenir transitaire</Link>
        </Button>
      </div>
    );
  }

  const meta = STATUS_META[forwarder.status] || STATUS_META.pending;
  const Icon = meta.icon;
  const routes = Array.isArray(forwarder.coverage_routes) ? forwarder.coverage_routes : [];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Espace transitaire</h1>
          <p className="text-sm text-muted-foreground">Suivi de votre dossier {forwarder.company_name}</p>
        </div>

        {/* Statut */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon className={meta.tone} size={20} />
              Statut KYB
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="outline" className={meta.tone}>{meta.label}</Badge>
            {forwarder.status === "pending" && (
              <p className="text-sm text-muted-foreground">
                Votre dossier est en cours d'examen par notre équipe. Vous serez notifié(e) par email
                dès qu'une décision sera prise (généralement sous 48-72h ouvrées).
              </p>
            )}
            {forwarder.status === "rejected" && forwarder.rejection_reason && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-semibold text-destructive mb-1">Motif du refus</p>
                <p className="text-sm text-foreground">{forwarder.rejection_reason}</p>
              </div>
            )}
            {forwarder.status === "suspended" && (
              <p className="text-sm text-muted-foreground">
                Votre compte est temporairement suspendu. Contactez le support pour plus d'informations.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Identité & contact */}
        <Card>
          <CardHeader><CardTitle>Identité & contact</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Nom commercial : </span><span className="text-foreground">{forwarder.company_name}</span></div>
            {forwarder.legal_name && <div><span className="text-muted-foreground">Raison sociale : </span><span className="text-foreground">{forwarder.legal_name}</span></div>}
            {forwarder.contact_email && <div><span className="text-muted-foreground">Email : </span><span className="text-foreground">{forwarder.contact_email}</span></div>}
            {forwarder.contact_phone && <div><span className="text-muted-foreground">Téléphone : </span><span className="text-foreground">{forwarder.contact_phone}</span></div>}
            {forwarder.headquarters_city && (
              <div className="md:col-span-2 flex items-center gap-1">
                <MapPin size={14} className="text-muted-foreground" />
                <span className="text-foreground">{forwarder.headquarters_city}, {forwarder.headquarters_country}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Couverture */}
        <Card>
          <CardHeader><CardTitle>Couverture & modes</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              {(forwarder.supported_modes || []).map((m) => (
                <Badge key={m} variant="secondary">{m.toUpperCase()}</Badge>
              ))}
            </div>
            {routes.length > 0 ? (
              <ul className="space-y-1">
                {routes.map((r: any, i: number) => (
                  <li key={i} className="text-foreground">
                    • {r.origin || "?"} → {r.destination || "?"} {r.mode && <span className="text-muted-foreground">({r.mode})</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Aucune route déclarée.</p>
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText size={18} /> Documents soumis</CardTitle></CardHeader>
          <CardContent>
            {signedDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun document attaché.</p>
            ) : (
              <ul className="space-y-2">
                {signedDocs.map((d, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm border border-border rounded-md p-2">
                    <span className="text-foreground truncate">{d.name}</span>
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      <ExternalLink size={12} /> Voir
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Tarifs (CTA) */}
        {forwarder.status === "approved" && (
          <Card className="border-primary/30">
            <CardContent className="py-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Gérer vos tarifs</p>
                <p className="text-xs text-muted-foreground">Configurez vos profils tarifaires et routes (à venir).</p>
              </div>
              <Button asChild variant="outline" size="sm" disabled>
                <span>Bientôt disponible</span>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}