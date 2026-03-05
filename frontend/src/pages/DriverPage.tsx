import { Bike, MapPin, Navigation, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { Navigate } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";

/**
 * /driver route — redirects to the rider dashboard.
 * This is a PWA-friendly entry point for drivers.
 */
export default function DriverPage() {
  const { user, loading: authLoading } = useAuth();
  const { isRider, isAdmin, loading: rolesLoading } = useRoles();

  if (authLoading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <SEOHead title="Livreur — Zandofy" description="Espace livreur Zandofy" />
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (isRider || isAdmin) return <Navigate to="/rider" replace />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4">
      <SEOHead title="Livreur — Zandofy" description="Espace livreur Zandofy" />
      <Bike size={48} className="text-muted-foreground" />
      <h1 className="text-lg font-bold text-foreground text-center">Accès Livreur requis</h1>
      <p className="text-sm text-muted-foreground text-center">Contactez l'administrateur pour obtenir le rôle Livreur.</p>
      <a href="/" className="text-sm text-primary underline">Retour à l'accueil</a>
    </div>
  );
}
