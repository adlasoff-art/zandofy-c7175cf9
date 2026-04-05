import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useQuery } from "@tanstack/react-query";
import { fromTable } from "@/lib/supabase-helpers";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Check, Crown, Truck, Warehouse, Percent, ArrowRight, Package, Shield, Star, Zap, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const visibilityLabels: Record<string, string> = {
  standard: "Standard",
  badge_verified: "Badge vérifié",
  homepage_promo: "Accueil & Promo",
  dedicated_manager: "Gestionnaire dédié",
};

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-10 max-w-6xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Tarification</h1>
          <p className="text-base text-muted-foreground mt-3 max-w-2xl mx-auto">
            Découvrez nos packages vendeurs et clients. Transparence totale, sans frais cachés.
          </p>
        </div>

        {/* Commission */}
        <section className="mb-10">
          <div className="bg-card border border-border rounded-xl p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Percent size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Commission plateforme</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Une commission de <span className="font-bold text-foreground">10%</span> est appliquée par défaut sur chaque vente livrée pour les boutiques indépendantes.
                Ce taux peut être ajusté individuellement selon le volume de ventes.
              </p>
            </div>
          </div>
        </section>

        {/* Vendor Packages */}
        <section className="mb-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <Crown size={22} className="text-primary" />
              <h2 className="text-xl font-bold text-foreground">Packages vendeur</h2>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-full p-0.5 text-sm">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-1.5 rounded-full transition-colors ${billingCycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`px-4 py-1.5 rounded-full transition-colors ${billingCycle === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Annuel
              </button>
            </div>
          </div>

          {vendorLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-72 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : vendorPackages.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Package size={40} className="mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Aucun package disponible pour le moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {vendorPackages.map((pkg: any, idx: number) => {
                const price = billingCycle === "yearly" ? pkg.price_yearly : pkg.price_monthly;
                const isPopular = pkg.rank === 2;
                const services = pkg.included_services || [];

                return (
                  <div
                    key={pkg.id}
                    className={`bg-card border-2 rounded-xl p-5 flex flex-col relative ${
                      isPopular ? "border-primary" : "border-border"
                    }`}
                  >
                    {isPopular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-primary text-primary-foreground px-3 py-1 rounded-full">
                        Populaire
                      </span>
                    )}
                    <h3 className="text-base font-bold text-foreground">{pkg.name}</h3>
                    {pkg.description && <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>}

                    <div className="mt-4">
                      <span className="text-2xl font-bold text-foreground">${price}</span>
                      <span className="text-sm text-muted-foreground">/{billingCycle === "yearly" ? "an" : "mois"}</span>
                    </div>

                    <ul className="mt-4 space-y-2 flex-1 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Truck size={14} className="text-primary shrink-0" />
                        {pkg.max_deliveries_per_day} courses/jour
                      </li>
                      <li className="flex items-center gap-2">
                        <Truck size={14} className="text-primary shrink-0" />
                        {pkg.max_riders} livreur{pkg.max_riders > 1 ? "s" : ""}
                      </li>
                      <li className="flex items-center gap-2">
                        <Warehouse size={14} className="text-primary shrink-0" />
                        {pkg.hub_storage_free_kg > 0 ? `${pkg.hub_storage_free_kg} kg gratuit` : "Stockage payant"}
                      </li>
                      <li className="flex items-center gap-2">
                        <Shield size={14} className="text-primary shrink-0" />
                        Retrait {pkg.withdrawal_delay_days}j
                      </li>
                      <li className="flex items-center gap-2">
                        <Star size={14} className="text-primary shrink-0" />
                        {visibilityLabels[pkg.visibility_level] || pkg.visibility_level}
                      </li>
                      <li className="flex items-center gap-2">
                        <Zap size={14} className="text-primary shrink-0" />
                        {services.length} service{services.length > 1 ? "s" : ""} inclus
                      </li>
                    </ul>

                    {pkg.trust_threshold_months > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-2 bg-muted/50 rounded px-2 py-1">
                        Seuil confiance: {pkg.trust_threshold_months} mois + ${pkg.trust_threshold_sales} ventes
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Client Packages */}
        {clientPackages.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-6">
              <Package size={22} className="text-primary" />
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

        {/* Hub Storage */}
        <section className="mb-10">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Warehouse size={22} className="text-primary" />
              <h2 className="text-xl font-bold text-foreground">Stockage Hub</h2>
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>• <span className="font-semibold text-foreground">14 jours</span> de stockage gratuit (lundi – samedi, hors jours fériés)</p>
              <p>• À partir du 15ᵉ jour : <span className="font-semibold text-foreground">$0,59/jour par kg</span> pour tout stock ≥ 1 kg</p>
              <p>• Le quota gratuit dépend du package souscrit (0 kg pour Standard, jusqu'à 250 kg pour Entreprise)</p>
              <p>• Pénalités prélevées automatiquement sur le solde de la boutique</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center bg-primary/5 border border-primary/20 rounded-xl p-8">
          <h2 className="text-lg font-bold text-foreground mb-2">Prêt à vendre sur Zandofy ?</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-lg mx-auto">
            Pour souscrire à un package, vous devez avoir un compte vérifié et être vendeur approuvé sur la plateforme.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {user ? (
              <Link
                to="/vendor"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Mon espace vendeur <ArrowRight size={16} />
              </Link>
            ) : (
              <Link
                to="/become-vendor"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Devenir vendeur <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
