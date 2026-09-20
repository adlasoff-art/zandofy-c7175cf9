import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthSettings } from "@/hooks/use-auth-settings";
import { useGeoDetection } from "@/hooks/use-geo-detection";
import { useDiscoveryPrefs } from "@/contexts/DiscoveryPrefsContext";
import { CountryCombobox } from "@/components/vendor/CountryCombobox";
import { useActiveGeo } from "@/hooks/useActiveGeo";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  emptyDiscoveryPrefs,
  isDiscoverySnoozed,
  shouldShowReceiptStep,
  snoozeDiscoveryOnboarding,
  clearDiscoverySnooze,
  type DiscoveryPrefs,
  type PaymentPref,
  type PurchaseScope,
  type ReceiptMode,
  type ShoppingAudience,
} from "@/lib/discovery-prefs";
import { trackDiscoveryOnboarding } from "@/hooks/use-analytics";
import { setDiscoverySheetOpen } from "@/lib/discovery-sheet-bus";
import { Check, ChevronRight, Sparkles, X } from "lucide-react";

type StepId = "audience" | "interests" | "scope" | "receipt" | "payment" | "country";

const AUDIENCE_OPTIONS: { value: ShoppingAudience; label: string }[] = [
  { value: "male", label: "Hommes" },
  { value: "female", label: "Femmes" },
  { value: "both", label: "Hommes et femmes" },
  { value: "any", label: "Peu importe" },
];

const SCOPE_OPTIONS: { value: PurchaseScope; label: string }[] = [
  { value: "city", label: "Dans ma ville" },
  { value: "country", label: "Dans mon pays" },
  { value: "any_country", label: "N'importe quel pays" },
];

const RECEIPT_OPTIONS: { value: ReceiptMode; label: string }[] = [
  { value: "home_delivery", label: "Livraison à domicile" },
  { value: "pickup", label: "Retrait en magasin / point relais" },
];

const PAYMENT_OPTIONS: { value: PaymentPref; label: string }[] = [
  { value: "mobile_money", label: "Mobile Money" },
  { value: "card", label: "Carte bancaire" },
  { value: "off_platform", label: "Autre (hors plateforme)" },
  { value: "later", label: "Je choisis plus tard" },
];

type OpenRequest = { force?: boolean } | null;

let openListener: ((req: OpenRequest) => void) | null = null;

/** Open discovery onboarding from elsewhere (e.g. dashboard « Modifier mes goûts »). */
export function requestDiscoveryOnboarding(force = true) {
  openListener?.({ force });
}

function buildStepList(
  draft: DiscoveryPrefs,
  stepsCfg: { payment: boolean; receipt: boolean },
): StepId[] {
  const steps: StepId[] = ["audience", "interests", "scope"];
  if (shouldShowReceiptStep(draft.purchase_scope, stepsCfg)) steps.push("receipt");
  if (stepsCfg.payment !== false) steps.push("payment");
  steps.push("country");
  return steps;
}

export function DiscoveryOnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: authSettings, isFetched: authSettingsFetched } = useAuthSettings();
  const { prefs, setPrefs, hasCompleted } = useDiscoveryPrefs();
  const location = useLocation();
  const geo = useGeoDetection();
  const { activeCountryCodes } = useActiveGeo();

  const [open, setOpen] = useState(false);
  const [forceEdit, setForceEdit] = useState(false);
  const [draft, setDraft] = useState<DiscoveryPrefs>(emptyDiscoveryPrefs());
  const [stepIndex, setStepIndex] = useState(0);
  const [shownTracked, setShownTracked] = useState(false);

  const enabled = authSettings?.discovery_onboarding_enabled !== false;
  const stepsCfg = authSettings?.discovery_onboarding_steps || { payment: true, receipt: true };

  const hideOnAuthRoutes = useMemo(() => {
    const p = location.pathname;
    return (
      p.startsWith("/auth") ||
      p.startsWith("/admin") ||
      p.startsWith("/vendor") ||
      p.startsWith("/checkout") ||
      p.startsWith("/onboarding") ||
      p === "/banned"
    );
  }, [location.pathname]);

  useEffect(() => {
    openListener = (req) => {
      if (!enabled && !req?.force) return;
      if (req?.force) clearDiscoverySnooze();
      setForceEdit(!!req?.force);
      setDraft(prefs.completed_at || prefs.audience ? { ...prefs } : emptyDiscoveryPrefs());
      setStepIndex(0);
      setOpen(true);
      setShownTracked(false);
    };
    return () => {
      openListener = null;
    };
  }, [enabled, prefs]);

  // Soft trigger: ~4s on Accueil, never if completed / snoozed / already open
  // Wait for auth_settings so kill-switch is respected before first paint timer.
  useEffect(() => {
    if (!authSettingsFetched || !enabled || hideOnAuthRoutes || hasCompleted || isDiscoverySnoozed() || forceEdit || open) {
      return;
    }
    if (location.pathname !== "/") return;
    const t = window.setTimeout(() => {
      if (hasCompleted || isDiscoverySnoozed() || open) return;
      setDraft(emptyDiscoveryPrefs());
      setStepIndex(0);
      setOpen(true);
      setShownTracked(false);
    }, 4000);
    return () => window.clearTimeout(t);
  }, [authSettingsFetched, enabled, hideOnAuthRoutes, hasCompleted, location.pathname, forceEdit, open]);

  // Lock body scroll while sheet is open + notify popup bus
  useEffect(() => {
    setDiscoverySheetOpen(open);
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      setDiscoverySheetOpen(false);
    };
  }, [open]);

  useEffect(() => {
    if (open && !shownTracked) {
      trackDiscoveryOnboarding("discovery_onboarding_shown", {}, user?.id);
      setShownTracked(true);
    }
  }, [open, shownTracked, user?.id]);

  const { data: categories = [] } = useQuery({
    queryKey: ["discovery-root-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("id, name, name_fr, image_url, parent_id, sort_order")
        .is("parent_id", null)
        .order("sort_order")
        .order("name_fr")
        .limit(15);
      if (error) throw error;
      return (data || []) as { id: string; name: string; name_fr: string; image_url: string | null }[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const steps = useMemo(() => buildStepList(draft, stepsCfg), [draft, stepsCfg]);
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)] || "audience";
  const progress = ((stepIndex + 1) / Math.max(steps.length, 1)) * 100;

  // Clamp step when list shrinks (e.g. any_country removes receipt)
  useEffect(() => {
    if (stepIndex >= steps.length) {
      setStepIndex(Math.max(0, steps.length - 1));
    }
  }, [steps.length, stepIndex]);

  useEffect(() => {
    if (!draft.country_code && geo.country_code) {
      setDraft((d) => ({ ...d, country_code: geo.country_code }));
    }
  }, [geo.country_code, draft.country_code]);

  const closeDismiss = useCallback(() => {
    snoozeDiscoveryOnboarding();
    trackDiscoveryOnboarding("discovery_onboarding_dismissed", { step: currentStep }, user?.id);
    setOpen(false);
    setForceEdit(false);
  }, [currentStep, user?.id]);

  const finish = useCallback(
    (finalDraft: DiscoveryPrefs, skipped = false) => {
      const next: DiscoveryPrefs = {
        ...finalDraft,
        completed_at: skipped ? finalDraft.completed_at : new Date().toISOString(),
        skipped_at: skipped ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      if (!skipped) clearDiscoverySnooze();
      setPrefs(next, { persistProfile: !!user });
      trackDiscoveryOnboarding(
        skipped ? "discovery_onboarding_dismissed" : "discovery_onboarding_completed",
        {
          audience: next.audience,
          interests: next.interest_category_ids,
          purchase_scope: next.purchase_scope,
          receipt_mode: next.receipt_mode,
          payment_prefs: next.payment_prefs,
          country_code: next.country_code,
        },
        user?.id,
      );
      setOpen(false);
      setForceEdit(false);
    },
    [setPrefs, user],
  );

  const goNext = () => {
    trackDiscoveryOnboarding(
      "discovery_onboarding_step_complete",
      { step: currentStep },
      user?.id,
    );
    if (stepIndex >= steps.length - 1) {
      finish(draft, false);
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const canContinue = () => {
    switch (currentStep) {
      case "audience":
        return !!draft.audience;
      case "interests":
        return draft.interest_category_ids.length >= 1 && draft.interest_category_ids.length <= 5;
      case "scope":
        return !!draft.purchase_scope;
      case "receipt":
        return !!draft.receipt_mode;
      case "payment":
        return draft.payment_prefs.length >= 1;
      case "country":
        return !!draft.country_code;
      default:
        return true;
    }
  };

  const skipPayment = () => {
    trackDiscoveryOnboarding("discovery_onboarding_step_skip", { step: "payment" }, user?.id);
    setDraft((d) => ({ ...d, payment_prefs: ["later"] }));
    // Payment is never the last step (country follows); advance without finish.
    setStepIndex((i) => Math.min(i + 1, Math.max(0, steps.length - 1)));
  };

  const toggleInterest = (id: string) => {
    setDraft((d) => {
      const has = d.interest_category_ids.includes(id);
      if (has) return { ...d, interest_category_ids: d.interest_category_ids.filter((x) => x !== id) };
      if (d.interest_category_ids.length >= 5) return d;
      return { ...d, interest_category_ids: [...d.interest_category_ids, id] };
    });
  };

  if (!open) return <>{children}</>;

  return (
    <>
      {children}
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
          aria-label="Fermer"
          onClick={closeDismiss}
        />
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full sm:max-w-2xl lg:max-w-3xl max-h-[96vh] sm:max-h-[90vh] overflow-y-auto bg-primary text-primary-foreground border border-primary/20 sm:rounded-3xl rounded-t-3xl shadow-2xl p-6 sm:p-10 animate-in slide-in-from-bottom-4 fade-in zoom-in-95 duration-400"
        >
          <div className="flex items-start justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary-foreground/15 flex items-center justify-center ring-2 ring-primary-foreground/25">
                <Sparkles size={22} className="text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-primary-foreground leading-tight">
                  Une meilleure expérience pour vous
                </h2>
                <p className="text-sm text-primary-foreground/80 mt-1">
                  Quelques choix pour afficher ce qui vous correspond
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeDismiss}
              className="p-2 rounded-md text-primary-foreground/80 hover:bg-primary-foreground/10"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>

          <Progress value={progress} className="h-2 mb-6 bg-primary-foreground/20 [&>div]:bg-primary-foreground" />

          {currentStep === "audience" && (
            <StepBlock title="Vous cherchez plutôt des articles pour… ?">
              <div className="grid grid-cols-2 gap-2">
                {AUDIENCE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={draft.audience === o.value}
                    onClick={() => setDraft((d) => ({ ...d, audience: o.value }))}
                  />
                ))}
              </div>
            </StepBlock>
          )}

          {currentStep === "interests" && (
            <StepBlock
              title="Qu’est-ce qui vous intéresse le plus ?"
              hint="Jusqu’à 5 choix"
            >
              <div className="grid grid-cols-3 gap-2">
                {categories.slice(0, 12).map((c) => {
                  const selected = draft.interest_category_ids.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleInterest(c.id)}
                      className={cn(
                        "relative flex flex-col items-center gap-2 p-3 rounded-2xl border text-center transition-all",
                        selected
                          ? "border-primary-foreground bg-primary-foreground text-primary ring-2 ring-primary-foreground/40"
                          : "border-primary-foreground/35 text-primary-foreground bg-primary-foreground/5 hover:bg-primary-foreground/15",
                      )}
                    >
                      {selected && (
                        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check size={12} />
                        </span>
                      )}
                      {c.image_url ? (
                        <img src={c.image_url} alt="" className="w-14 h-14 object-cover rounded-xl" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-primary-foreground/20" />
                      )}
                      <span className="text-xs font-medium leading-tight line-clamp-2">
                        {c.name_fr || c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </StepBlock>
          )}

          {currentStep === "scope" && (
            <StepBlock title="Où préférez-vous acheter ?">
              <div className="space-y-2">
                {SCOPE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={draft.purchase_scope === o.value}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        purchase_scope: o.value,
                        receipt_mode:
                          o.value === "any_country" ? null : d.receipt_mode,
                      }))
                    }
                    fullWidth
                  />
                ))}
              </div>
            </StepBlock>
          )}

          {currentStep === "receipt" && (
            <StepBlock title="Comment préférez-vous recevoir vos commandes ?">
              <div className="space-y-2">
                {RECEIPT_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={draft.receipt_mode === o.value}
                    onClick={() => setDraft((d) => ({ ...d, receipt_mode: o.value }))}
                    fullWidth
                  />
                ))}
              </div>
            </StepBlock>
          )}

          {currentStep === "payment" && (
            <StepBlock title="Quel moyen de paiement vous convient le mieux ?">
              <div className="space-y-2">
                {PAYMENT_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={draft.payment_prefs[0] === o.value}
                    onClick={() => setDraft((d) => ({ ...d, payment_prefs: [o.value] }))}
                    fullWidth
                  />
                ))}
              </div>
              <button
                type="button"
                className="text-xs text-primary-foreground/80 underline mt-3"
                onClick={skipPayment}
              >
                Passer cette étape
              </button>
            </StepBlock>
          )}

          {currentStep === "country" && (
            <StepBlock title="Dans quel pays êtes-vous ?">
              <CountryCombobox
                value={draft.country_code || ""}
                onChange={(code) => setDraft((d) => ({ ...d, country_code: code || null }))}
                label=""
                showNone={false}
                allowedCodes={activeCountryCodes.length ? activeCountryCodes : undefined}
                placeholder="Sélectionner un pays…"
              />
            </StepBlock>
          )}

          <div className="flex items-center gap-3 mt-8">
            {stepIndex > 0 && (
              <Button
                type="button"
                variant="outline"
                className="border-primary-foreground/40 text-primary-foreground bg-transparent hover:bg-primary-foreground/10"
                onClick={() => setStepIndex((i) => i - 1)}
              >
                Retour
              </Button>
            )}
            <Button
              type="button"
              className="flex-1 bg-primary-foreground text-primary hover:bg-primary-foreground/90 h-11 text-base"
              disabled={!canContinue()}
              onClick={goNext}
            >
              {stepIndex >= steps.length - 1 ? "Voir mon catalogue" : "Continuer"}
              <ChevronRight size={18} className="ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function StepBlock({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-primary-foreground">{title}</h3>
        {hint && <p className="text-sm text-primary-foreground/75 mt-1">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ChoiceCard({
  label,
  selected,
  onClick,
  fullWidth,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-4 rounded-2xl border text-sm sm:text-base font-medium transition-all text-left",
        fullWidth ? "w-full" : "",
        selected
          ? "border-primary-foreground bg-primary-foreground text-primary ring-2 ring-primary-foreground/40"
          : "border-primary-foreground/35 text-primary-foreground bg-primary-foreground/5 hover:bg-primary-foreground/15",
      )}
    >
      {label}
    </button>
  );
}
