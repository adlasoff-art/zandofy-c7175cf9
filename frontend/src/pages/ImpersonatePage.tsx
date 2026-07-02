import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { throwIfEdgeFunctionError } from "@/services/admin-email";
import { Loader2, AlertTriangle } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

export default function ImpersonatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Échange du token d'impersonation...");
  const exchangeStarted = useRef(false);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Token d'impersonation manquant");
      return;
    }

    if (exchangeStarted.current) return;
    exchangeStarted.current = true;

    (async () => {
      try {
        // Save admin tokens before swapping
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          sessionStorage.setItem("impersonation_admin_access_token", currentSession.access_token);
          sessionStorage.setItem("impersonation_admin_refresh_token", currentSession.refresh_token);
        }

        setStatus("Validation du token...");

        // Exchange the impersonation token for a real session
        const res = await supabase.functions.invoke("impersonate-user", {
          body: { action: "exchange", token },
        });

        await throwIfEdgeFunctionError(res);

        const { session, admin_id, target } = res.data;

        setStatus("Connexion en cours...");

        // Set the new session (this will log in as the target user)
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });

        if (setSessionError) throw setSessionError;

        // Store impersonation metadata in sessionStorage
        sessionStorage.setItem("impersonation_admin_id", admin_id);
        sessionStorage.setItem("impersonation_target_id", target.id);
        sessionStorage.setItem("impersonation_target_email", target.email || "");
        sessionStorage.setItem("impersonation_active", "true");

        // Redirect based on roles
        const roles: string[] = target.roles || [];
        if (roles.includes("admin") || roles.includes("manager")) {
          navigate("/admin", { replace: true });
        } else if (roles.includes("vendor")) {
          navigate("/vendor", { replace: true });
        } else if (roles.includes("rider")) {
          navigate("/rider", { replace: true });
        } else if (roles.includes("shipper")) {
          navigate("/shipper", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      } catch (e: any) {
        console.error("Impersonation exchange failed:", e);
        setError(e.message || "Échec de l'impersonation");
      }
    })();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-card border border-border rounded-xl p-8 max-w-md text-center space-y-4">
          <AlertTriangle className="mx-auto text-destructive" size={40} />
          <h1 className="text-lg font-bold text-foreground">Erreur d'impersonation</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            Fermer cet onglet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SEOHead title="Impersonation" description="Échange du token d'impersonation." noindex />
      <div className="text-center space-y-4">
        <Loader2 className="mx-auto animate-spin text-primary" size={32} />
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
