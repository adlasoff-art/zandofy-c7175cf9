import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertTriangle, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * /rider-invite?token=...&email=...
 *
 * Si non connecté : invite à se connecter ou s'inscrire avec l'email cible.
 * Si connecté : appelle operator-accept-rider-invite et redirige vers KYC/dashboard.
 */
export default function RiderInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const targetEmail = (params.get("email") || "").toLowerCase();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "accepting" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (authLoading || !user || !token || state !== "idle") return;
    // Si l'email connecté ne correspond pas, ne pas appeler la fonction
    if (targetEmail && user.email && user.email.toLowerCase() !== targetEmail) {
      setState("error");
      setMessage(`Cette invitation est destinée à ${targetEmail}. Déconnectez-vous et reconnectez-vous avec ce compte.`);
      return;
    }
    setState("accepting");
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("operator-accept-rider-invite", {
          body: { token },
        });
        if (error) {
          let serverMsg = error.message;
          try {
            const ctx = (error as any).context;
            if (ctx && typeof ctx.json === "function") {
              const body = await ctx.json();
              serverMsg = body?.error || serverMsg;
            }
          } catch { /* ignore */ }
          setState("error");
          setMessage(serverMsg || "Échec de l'acceptation");
          return;
        }
        if ((data as any)?.error) {
          setState("error");
          setMessage((data as any).error);
          return;
        }
        setState("success");
        setMessage((data as any)?.message || "Invitation acceptée.");
      } catch (e: any) {
        setState("error");
        setMessage(e?.message || "Erreur inattendue");
      }
    })();
  }, [authLoading, user, token, targetEmail, state]);

  if (!token) {
    return (
      <CenteredCard>
        <AlertTriangle className="text-destructive" size={36} />
        <h1 className="text-lg font-bold text-foreground">Lien invalide</h1>
        <p className="text-sm text-muted-foreground text-center">
          Le lien d'invitation est incomplet. Demandez à l'opérateur de vous renvoyer un email.
        </p>
        <Link to="/" className="text-sm text-primary underline">Retour à l'accueil</Link>
      </CenteredCard>
    );
  }

  if (authLoading) {
    return (
      <CenteredCard>
        <Loader2 className="animate-spin text-primary" size={32} />
      </CenteredCard>
    );
  }

  if (!user) {
    const redirectPath = `/rider-invite?token=${encodeURIComponent(token)}${targetEmail ? `&email=${encodeURIComponent(targetEmail)}` : ""}`;
    return (
      <CenteredCard>
        <Bike className="text-primary" size={36} />
        <h1 className="text-lg font-bold text-foreground text-center">Invitation livreur</h1>
        <p className="text-sm text-muted-foreground text-center">
          Connectez-vous ou créez votre compte avec l'email <span className="font-semibold text-foreground">{targetEmail || "cible"}</span> pour accepter cette invitation.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button asChild>
            <Link to={`/auth?redirect=${encodeURIComponent(redirectPath)}&mode=signup${targetEmail ? `&email=${encodeURIComponent(targetEmail)}` : ""}`}>
              Créer mon compte livreur
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`/auth?redirect=${encodeURIComponent(redirectPath)}`}>
              J'ai déjà un compte
            </Link>
          </Button>
        </div>
      </CenteredCard>
    );
  }

  if (state === "accepting" || state === "idle") {
    return (
      <CenteredCard>
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-sm text-muted-foreground">Acceptation de l'invitation…</p>
      </CenteredCard>
    );
  }

  if (state === "success") {
    return (
      <CenteredCard>
        <CheckCircle2 className="text-emerald-500" size={36} />
        <h1 className="text-lg font-bold text-foreground text-center">{message}</h1>
        <p className="text-sm text-muted-foreground text-center">
          Étape suivante : complétez votre KYC pour être activable par l'opérateur.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button onClick={() => navigate("/dashboard?tab=kyc")}>Compléter mon KYC</Button>
          <Button variant="outline" onClick={() => navigate("/rider")}>Aller au dashboard livreur</Button>
        </div>
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <AlertTriangle className="text-destructive" size={36} />
      <h1 className="text-lg font-bold text-foreground text-center">Impossible d'accepter l'invitation</h1>
      <p className="text-sm text-muted-foreground text-center">{message}</p>
      <Link to="/" className="text-sm text-primary underline">Retour à l'accueil</Link>
    </CenteredCard>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full flex flex-col items-center gap-4">
        {children}
      </div>
    </div>
  );
}