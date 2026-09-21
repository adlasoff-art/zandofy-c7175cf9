import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isSyntheticAuthEmail } from "@/lib/auth-helpers";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";

type SoftReason = "placeholder" | "unconfirmed" | null;

/**
 * Non-blocking banner: push real email / verify without stopping browse or checkout.
 */
export function ProfileCompletionBanner({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [reason, setReason] = useState<SoftReason>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) {
      setReason(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        if (localStorage.getItem(`zandofy_profile_banner_dismiss_${user.id}`)) {
          if (!cancelled) setDismissed(true);
        }
      } catch {
        /* ignore */
      }

      const synthetic = isSyntheticAuthEmail(user.email);
      let placeholder = synthetic;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("email_is_placeholder")
          .eq("id", user.id)
          .maybeSingle();
        if ((data as any)?.email_is_placeholder === true) placeholder = true;
      } catch {
        /* column may be absent until migration */
      }

      if (cancelled) return;
      if (placeholder) setReason("placeholder");
      else if (!user.email_confirmed_at && user.email && !synthetic) setReason("unconfirmed");
      else setReason(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, user?.email_confirmed_at]);

  if (!user || !reason || dismissed) return null;

  const title =
    reason === "placeholder"
      ? t("profile.completeEmailTitle") || "Ajoutez un email"
      : t("profile.verifyEmailTitle") || "Vérifiez votre email";
  const desc =
    reason === "placeholder"
      ? t("profile.completeEmailDesc") ||
        "Pour récupérer votre mot de passe et recevoir vos reçus, ajoutez un email réel."
      : t("profile.verifyEmailDesc") ||
        "Confirmez votre adresse pour sécuriser votre compte — sans bloquer vos commandes.";

  return (
    <div
      className={`rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 ${className}`}
      role="status"
    >
      <div className="flex items-start gap-2 flex-1 min-w-0">
        {reason === "placeholder" ? (
          <Mail size={16} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle size={16} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{title}</p>
          <p className="text-xs text-amber-800/90 dark:text-amber-300/90">{desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button asChild size="sm" variant="outline" className="h-8 border-amber-400">
          <Link to="/account?tab=settings">{t("profile.completeCta") || "Compléter"}</Link>
        </Button>
        <button
          type="button"
          className="text-xs text-amber-800/80 hover:underline px-1"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(`zandofy_profile_banner_dismiss_${user.id}`, "1");
            } catch {
              /* ignore */
            }
          }}
        >
          {t("general.dismiss") || "Plus tard"}
        </button>
      </div>
    </div>
  );
}
