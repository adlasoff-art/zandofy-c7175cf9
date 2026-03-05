import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles, type AppRole } from "@/hooks/use-roles";
import { Loader2, ShieldAlert } from "lucide-react";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  fallback?: string;
}

export function RoleGuard({ children, allowedRoles, fallback = "/" }: RoleGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useRoles();

  if (authLoading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const hasAccess = allowedRoles.some((r) => roles.includes(r));

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <ShieldAlert size={48} className="text-destructive" />
        <h1 className="text-lg font-bold text-foreground">Accès refusé</h1>
        <p className="text-sm text-muted-foreground">Vous n'avez pas les permissions pour accéder à cette page.</p>
        <a href={fallback} className="text-sm text-primary underline">Retour à l'accueil</a>
      </div>
    );
  }

  return <>{children}</>;
}
