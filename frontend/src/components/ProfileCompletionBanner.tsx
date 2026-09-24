import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Mail, MapPin, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isSyntheticAuthEmail } from "@/lib/auth-helpers";
import { useI18n } from "@/contexts/I18nContext";
import { useKycStatus } from "@/hooks/use-kyc";
import { Button } from "@/components/ui/button";

export type ProfileGap = "need_email" | "need_verify" | "need_address" | "need_kyc";

const GAP_PRIORITY: ProfileGap[] = ["need_email", "need_verify", "need_address", "need_kyc"];

/**
 * Permanent (non-dismissible) soft banner: email attach/verify, address, KYC.
 * Does not hard-block browse; deep-links to dashboard tabs.
 */
export function ProfileCompletionBanner({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { needsKyc, kycStatus } = useKycStatus();
  const [gaps, setGaps] = useState<ProfileGap[]>([]);

  useEffect(() => {
    if (!user) {
      setGaps([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: ProfileGap[] = [];
      const synthetic = isSyntheticAuthEmail(user.email);
      let placeholder = synthetic;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("email_is_placeholder")
          .eq("id", user.id)
          .maybeSingle();
        if ((data as { email_is_placeholder?: boolean } | null)?.email_is_placeholder === true) {
          placeholder = true;
        }
      } catch {
        /* column may be absent */
      }

      if (placeholder || !user.email) next.push("need_email");
      else if (!user.email_confirmed_at && !synthetic) next.push("need_verify");

      try {
        const { count } = await supabase
          .from("saved_addresses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        if ((count ?? 0) === 0) next.push("need_address");
      } catch {
        /* ignore */
      }

      if (needsKyc && kycStatus !== "approved" && kycStatus !== "pending") {
        next.push("need_kyc");
      }

      if (!cancelled) {
        setGaps(GAP_PRIORITY.filter((g) => next.includes(g)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, user?.email_confirmed_at, needsKyc, kycStatus]);

  if (!user || gaps.length === 0) return null;

  const reason = gaps[0];
  const ctaHref =
    reason === "need_address"
      ? "/dashboard?tab=addresses"
      : reason === "need_kyc"
        ? "/dashboard?tab=kyc"
        : "/dashboard?tab=profile";

  const title =
    reason === "need_email"
      ? t("profile.completeEmailTitle") || "Ajoutez un email"
      : reason === "need_verify"
        ? t("profile.verifyEmailTitle") || "Vérifiez votre email"
        : reason === "need_address"
          ? t("profile.completeAddressTitle") || "Ajoutez une adresse"
          : t("profile.completeKycTitle") || "Vérifiez votre identité";

  const desc =
    reason === "need_email"
      ? t("profile.completeEmailDesc") ||
        "Pour récupérer votre mot de passe et recevoir vos reçus, ajoutez un email réel."
      : reason === "need_verify"
        ? t("profile.verifyEmailDesc") ||
          "Confirmez votre adresse pour sécuriser votre compte — sans bloquer vos commandes."
        : reason === "need_address"
          ? t("profile.completeAddressDesc") ||
            "Une adresse de livraison accélère le checkout et les livraisons."
          : t("profile.completeKycDesc") ||
            "Complétez votre KYC pour lever les limites de commande.";

  const Icon =
    reason === "need_email"
      ? Mail
      : reason === "need_address"
        ? MapPin
        : reason === "need_kyc"
          ? ShieldCheck
          : AlertTriangle;

  return (
    <div
      className={`rounded-none sm:rounded-lg border-b sm:border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 ${className}`}
      role="status"
    >
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <Icon size={16} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{title}</p>
          <p className="text-xs text-amber-800/90 dark:text-amber-300/90">{desc}</p>
          {gaps.length > 1 && (
            <p className="text-[10px] text-amber-700/80 mt-0.5">
              {gaps.length} étapes restantes
            </p>
          )}
        </div>
      </div>
      <Button asChild size="sm" variant="outline" className="h-8 border-amber-400 shrink-0">
        <Link to={ctaHref}>{t("profile.completeCta") || "Compléter"}</Link>
      </Button>
    </div>
  );
}

/** Pure helper for tests — priority pick. */
export function pickPrimaryProfileGap(gaps: ProfileGap[]): ProfileGap | null {
  return GAP_PRIORITY.find((g) => gaps.includes(g)) ?? null;
}
