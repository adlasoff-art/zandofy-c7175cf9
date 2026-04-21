import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { PackageSearch, Sparkles, ShieldCheck, Clock, Mail, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SourcingRequestForm } from "@/components/sourcing/SourcingRequestForm";
import { SourcingRequestCard } from "@/components/sourcing/SourcingRequestCard";

interface SourcingRequestRow {
  id: string;
  product_name: string | null;
  note: string | null;
  images: string[];
  status: "pending" | "answered" | "closed";
  created_at: string;
  product_sourcing_responses?: any;
}

export default function SourcingPage() {
  const { user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<SourcingRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("new");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("product_sourcing_requests" as any)
      .select("id, product_name, note, images, status, created_at, product_sourcing_responses(product_name, description, price, currency, min_quantity, colors, image_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRequests((data as any) ?? []);
    setLoading(false);

    // Mark answered requests as seen
    const unseen = ((data as any) ?? []).filter((r: any) => r.status === "answered");
    if (unseen.length > 0) {
      await supabase
        .from("product_sourcing_requests" as any)
        .update({ client_seen_response: true })
        .in("id", unseen.map((r: any) => r.id));
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-2xl py-6 pb-24">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <PackageSearch size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Trouvez-moi ce produit</h1>
              <p className="text-sm text-muted-foreground">Notre équipe recherche pour vous les produits absents du catalogue.</p>
            </div>
          </div>
        </header>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">Nouvelle demande</TabsTrigger>
            <TabsTrigger value="mine">Mes demandes ({requests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <SourcingRequestForm onSubmitted={() => { load(); setTab("mine"); }} />
            </div>
          </TabsContent>

          <TabsContent value="mine" className="mt-4 space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary" size={24} />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Aucune demande pour le moment.
              </div>
            ) : (
              requests.map((r) => (
                <SourcingRequestCard
                  key={r.id}
                  request={r}
                  response={Array.isArray(r.product_sourcing_responses) ? r.product_sourcing_responses[0] : r.product_sourcing_responses}
                />
              ))
            )}
          </TabsContent>
        </Tabs>

        <section className="mt-10 rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-3">À quoi sert cette page ?</h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Sparkles size={18} className="text-primary shrink-0 mt-0.5" />
              <p>Vous cherchez un produit qui n'est pas encore sur Zandofy ? Décrivez-le, ajoutez jusqu'à 2 photos, et notre équipe sourcing s'en occupe.</p>
            </div>
            <div className="flex items-start gap-3">
              <Clock size={18} className="text-primary shrink-0 mt-0.5" />
              <p>Réponse sous 24-72h ouvrées avec le prix, la quantité minimum, les couleurs disponibles et une photo de référence.</p>
            </div>
            <div className="flex items-start gap-3">
              <Mail size={18} className="text-primary shrink-0 mt-0.5" />
              <p>Vous serez notifié dans l'app et, si vous le souhaitez, par email dès qu'une réponse est prête.</p>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="text-primary shrink-0 mt-0.5" />
              <p>Limite : maximum 5 demandes par jour, jusqu'à 2 images par demande (cumul ≤ 4 Mo).</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}