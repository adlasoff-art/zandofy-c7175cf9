import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useQuery } from "@tanstack/react-query";
import { fromTable } from "@/lib/supabase-helpers";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Check, Crown, Warehouse, Percent, ArrowRight, Package, Phone } from "lucide-react";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";

export default function PricingPage() {
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const { data: vendorPackages = [], isLoading: vendorLoading } = useQuery({
    queryKey: ["public-packages-vendor"],
    queryFn: async () => {
      const { data } = await fromTable("service_packages")
        .select("*")
        .eq("is_active", true)
        .eq("target", "vendor")
        .order("rank", { ascending: true });
      return data || [];
    },
  });

  const { data: clientPackages = [] } = useQuery({
    queryKey: ["public-packages-client"],
    queryFn: async () => {
      const { data } = await fromTable("service_packages")
        .select("*")
        .eq("is_active", true)
        .eq("target", "client")
        .order("rank", { ascending: true });
      return data || [];
    },
  });

  const sortedVendor = [...vendorPackages]
    .filter((pkg: any) => pkg.slug !== "autonomous")
    .sort((a: any, b: any) =>
      a.slug === "vendor_mm_numbers" ? -1 : b.slug === "vendor_mm_numbers" ? 1 : a.rank - b.rank
    );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-10 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Tarification marketplace</h1>
          <p className="text-base text-muted-foreground mt-3 max-w-2xl mx-auto">
            Vendre est gratuit. Commission sur les commandes livrées. Optionnel : forfait numéros Mobile Money.
          </p>
        </div>

        <section className="mb-10">
          <div className="bg-card border border-border rounded-xl p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Percent size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Gratuit pour vendre + commission</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Boutique après KYC. Catalogue jusqu&apos;à 100 produits. Commission d&apos;environ{" "}
                <span className="font-bold text-foreground">10%</span> sur chaque commande livrée
                (paiement sécurisé Zandofy). Pas d&apos;abonnement obligatoire.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <Phone size={22} className="text-primary" />
              <h2 className="text-xl font-bold text-foreground">Upsell vendeur</h2>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className={`font-medium ${billingCycle === "monthly" ? "text-foreground" : "text-muted-foreground"}`}>Mensuel</span>
              <Switch
                checked={billingCycle === "yearly"}
                onCheckedChange={(checked) => setBillingCycle(checked ? "yearly" : "monthly")}
              />
              <span className={`font-medium ${billingCycle === "yearly" ? "text-foreground" : "text-muted-foreground"}`}>Annuel</span>
            </div>
          </div>

          {vendorLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => <div key={i} className="h-56 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : sortedVendor.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Package size={40} className="mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Aucun forfait disponible pour le moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedVendor.map((pkg: any) => {
                const price = billingCycle === "yearly" ? pkg.price_yearly : pkg.price_monthly;
                const isMm = pkg.slug === "vendor_mm_numbers";
                return (
                  <div
                    key={pkg.id}
                    className={`bg-card border-2 rounded-xl p-5 flex flex-col relative ${
                      isMm ? "border-primary" : "border-border"
                    }`}
                  >
                    {isMm && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-primary text-primary-foreground px-3 py-1 rounded-full">
                        Recommandé
                      </span>
                    )}
                    <h3 className="text-base font-bold text-foreground">{pkg.name}</h3>
                    {pkg.description && <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>}
                    <div className="mt-4">
                      <span className="text-2xl font-bold text-foreground">${price}</span>
                      <span className="text-sm text-muted-foreground">/{billingCycle === "yearly" ? "an" : "mois"}</span>
                    </div>
                    {isMm && (
                      <ul className="mt-4 space-y-2 flex-1 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2"><Check size={14} className="text-primary" /> Vos numéros Mobile Money au checkout</li>
                        <li className="flex items-center gap-2"><Check size={14} className="text-primary" /> Vendre reste gratuit + commission</li>
                      </ul>
                    )}
                    <Link
                      to={user ? "/vendor" : "/auth?mode=signup&redirect=/become-vendor"}
                      className="mt-5 w-full py-2.5 text-sm font-semibold text-center rounded-lg bg-primary text-primary-foreground hover:opacity-90"
                    >
                      {user ? "Ouvrir mon espace vendeur" : "Devenir vendeur"}
                      <ArrowRight size={14} className="inline ml-1" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {clientPackages.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-6">
              <Crown size={22} className="text-primary" />
              <h2 className="text-xl font-bold text-foreground">Forfaits client</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {clientPackages.map((pkg: any) => {
                const price = billingCycle === "yearly" ? pkg.price_yearly : pkg.price_monthly;
                return (
                  <div key={pkg.id} className="bg-card border border-border rounded-xl p-5 flex flex-col">
                    <h3 className="text-base font-bold text-foreground">{pkg.name}</h3>
                    {pkg.description && <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>}
                    <div className="mt-4">
                      <span className="text-2xl font-bold text-foreground">${price}</span>
                      <span className="text-sm text-muted-foreground">/{billingCycle === "yearly" ? "an" : "mois"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="mb-10">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Warehouse size={22} className="text-primary" />
              <h2 className="text-xl font-bold text-foreground">Stockage Hub</h2>
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>• <span className="font-semibold text-foreground">14 jours</span> de stockage gratuit</p>
              <p>• À partir du 15ᵉ jour : <span className="font-semibold text-foreground">$0,25/jour par kg</span></p>
            </div>
          </div>
        </section>

        <section className="text-center bg-primary/5 border border-primary/20 rounded-xl p-8">
          <h2 className="text-lg font-bold text-foreground mb-2">Prêt à vendre sur Zandofy ?</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-lg mx-auto">
            KYC personnel requis. Vendre est gratuit — commission uniquement sur les commandes livrées.
          </p>
          <Link
            to={user ? "/vendor" : "/become-vendor"}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90"
          >
            {user ? "Mon espace vendeur" : "Devenir vendeur"} <ArrowRight size={16} />
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
