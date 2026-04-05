import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Check, Crown, Truck, Warehouse, Percent, ArrowRight, Package } from "lucide-react";
import { useState } from "react";

interface ServicePlan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  features: string[];
  is_active: boolean;
}

export default function PricingPage() {
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const { data: servicePlans = [], isLoading } = useQuery({
    queryKey: ["public-service-plans"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("platform_service_plans")
        .select("*")
        .eq("is_active", true)
        .order("price_monthly", { ascending: true });
      return (data || []) as ServicePlan[];
    },
  });

  const deliveryTiers = [
    {
      label: "Standard",
      deliveries: "5 – 10 / jour",
      maxRiders: 2,
      hub: false,
      highlight: false,
    },
    {
      label: "Professionnel",
      deliveries: "20 – 50 / jour",
      maxRiders: 5,
      hub: true,
      highlight: true,
    },
    {
      label: "Premium",
      deliveries: "50 – 100 / jour",
      maxRiders: 10,
      hub: true,
      highlight: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-10 max-w-5xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Tarification</h1>
          <p className="text-base text-muted-foreground mt-3 max-w-2xl mx-auto">
            Découvrez les services et abonnements disponibles pour les vendeurs sur notre plateforme. Transparence totale, sans frais cachés.
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

        {/* Service Plans */}
        <section className="mb-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <Crown size={22} className="text-primary" />
              <h2 className="text-xl font-bold text-foreground">Plans de services</h2>
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

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-56 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : servicePlans.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Package size={40} className="mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Aucun plan disponible pour le moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {servicePlans.map(plan => {
                const price = billingCycle === "yearly" && plan.price_yearly
                  ? plan.price_yearly
                  : plan.price_monthly;
                const features = Array.isArray(plan.features) ? plan.features : [];
                return (
                  <div key={plan.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors flex flex-col">
                    <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                    )}
                    <div className="mt-4">
                      <span className="text-2xl font-bold text-foreground">${price}</span>
                      <span className="text-sm text-muted-foreground">/{billingCycle === "yearly" ? "an" : "mois"}</span>
                    </div>
                    {features.length > 0 && (
                      <ul className="mt-4 space-y-2 flex-1">
                        {features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Check size={16} className="text-primary shrink-0 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Delivery Plans */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-6">
            <Truck size={22} className="text-primary" />
            <h2 className="text-xl font-bold text-foreground">Plans de livraison vendeur</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {deliveryTiers.map(tier => (
              <div
                key={tier.label}
                className={`bg-card border-2 rounded-xl p-5 flex flex-col ${tier.highlight ? "border-primary" : "border-border"}`}
              >
                {tier.highlight && (
                  <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full self-start mb-2">
                    Populaire
                  </span>
                )}
                <h3 className="text-base font-bold text-foreground">{tier.label}</h3>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground flex-1">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary" />
                    {tier.deliveries}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary" />
                    Jusqu'à {tier.maxRiders} livreurs
                  </li>
                  <li className="flex items-center gap-2">
                    {tier.hub ? (
                      <Check size={14} className="text-primary" />
                    ) : (
                      <span className="w-3.5 text-muted-foreground/30 text-center">—</span>
                    )}
                    Stockage Hub
                  </li>
                </ul>
              </div>
            ))}
          </div>
        </section>

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
              <p>• Pénalités prélevées automatiquement sur le solde de la boutique</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center bg-primary/5 border border-primary/20 rounded-xl p-8">
          <h2 className="text-lg font-bold text-foreground mb-2">Prêt à vendre sur Zandofy ?</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-lg mx-auto">
            Pour souscrire à un service, vous devez avoir un compte vérifié et être vendeur approuvé sur la plateforme.
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
