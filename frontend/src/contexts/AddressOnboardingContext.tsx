import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthSettings } from "@/hooks/use-auth-settings";
import { supabase } from "@/integrations/supabase/client";
import { AddressOnboardingDialog } from "@/components/AddressOnboardingDialog";
import {
  requestAddressOnboarding,
  setAddressOnboardingListener,
} from "@/lib/address-onboarding-bus";

const SNOOZE_KEY = "zandofy_address_onboarding_snoozed";

export function AddressOnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: authSettings } = useAuthSettings();
  const [open, setOpen] = useState(false);
  const checkingRef = useRef(false);
  const openRef = useRef(false);
  const skipSnoozeRef = useRef(false);
  const userIdRef = useRef<string | undefined>(user?.id);
  const enabledRef = useRef(authSettings?.address_onboarding_enabled !== false);

  userIdRef.current = user?.id;
  enabledRef.current = authSettings?.address_onboarding_enabled !== false;
  openRef.current = open;

  const maybePrompt = useCallback(() => {
    const uid = userIdRef.current;
    if (!uid) return;
    if (enabledRef.current === false) return;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SNOOZE_KEY) === "1") {
      return;
    }
    if (checkingRef.current || openRef.current) return;

    checkingRef.current = true;
    void (async () => {
      try {
        const { count, error } = await supabase
          .from("saved_addresses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid);
        if (error) {
          console.warn("[AddressOnboarding]", error.message);
          return;
        }
        if ((count ?? 0) === 0) {
          openRef.current = true;
          setOpen(true);
        }
      } finally {
        checkingRef.current = false;
      }
    })();
  }, []);

  useEffect(() => {
    setAddressOnboardingListener(maybePrompt);
    return () => setAddressOnboardingListener(null);
  }, [maybePrompt]);

  // Next login (after logout) should re-prompt until an address exists.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        try {
          sessionStorage.removeItem(SNOOZE_KEY);
        } catch {
          /* ignore */
        }
        setOpen(false);
        openRef.current = false;
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    // Successful save closes via onSaved — do not snooze in that case
    if (!next && skipSnoozeRef.current) {
      skipSnoozeRef.current = false;
      openRef.current = false;
      setOpen(false);
      return;
    }
    if (!next) {
      try {
        sessionStorage.setItem(SNOOZE_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    openRef.current = next;
    setOpen(next);
  }, []);

  const handleSaved = useCallback(() => {
    try {
      sessionStorage.removeItem(SNOOZE_KEY);
    } catch {
      /* ignore */
    }
    skipSnoozeRef.current = true;
    openRef.current = false;
    setOpen(false);
  }, []);

  return (
    <>
      {children}
      <AddressOnboardingDialog
        open={open}
        onOpenChange={handleOpenChange}
        onSaved={handleSaved}
      />
    </>
  );
}

/** Convenience for callers that prefer a named import over the bus. */
export { requestAddressOnboarding };
