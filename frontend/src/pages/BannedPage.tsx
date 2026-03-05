import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Ban, Mail } from "lucide-react";

export default function BannedPage() {
  const { user, signOut } = useAuth();
  const [banReason, setBanReason] = useState<string | null>(null);
  const [bannedAt, setBannedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("ban_reason, banned_at")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setBanReason(data.ban_reason);
          setBannedAt(data.banned_at);
        }
      });
  }, [user]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
          <Ban size={40} className="text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Compte suspendu</h1>
          <p className="text-muted-foreground">
            Votre compte a été suspendu par l'équipe d'administration de la plateforme.
          </p>
        </div>

        {banReason && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-left">
            <p className="text-xs font-semibold text-destructive mb-1">Raison de la suspension</p>
            <p className="text-sm text-foreground">{banReason}</p>
            {bannedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Date : {new Date(bannedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
        )}

        <div className="bg-muted/30 rounded-xl p-4 text-left space-y-2">
          <p className="text-sm font-medium text-foreground">Que faire ?</p>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li>• Si vous pensez qu'il s'agit d'une erreur, contactez notre support</li>
            <li>• Vous pouvez envoyer un email de contestation</li>
            <li>• Les suspensions temporaires sont levées automatiquement</li>
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <a
            href="mailto:support@zandofy.com"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Mail size={16} />
            Contacter le support
          </a>
          <button
            onClick={signOut}
            className="w-full py-3 px-4 border border-border rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
