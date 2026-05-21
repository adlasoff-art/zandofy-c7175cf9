import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { logLoginEvent, logLogoutEvent } from "@/hooks/use-activity-logger";
import { fromTable } from "@/lib/supabase-helpers";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isBanned: boolean;
  isRecoveringPassword: boolean;
  clearRecoveryFlag: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isBanned: false,
  isRecoveringPassword: false,
  clearRecoveryFlag: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);

  const ensureProfile = useCallback(async (authUser: User) => {
    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .eq("id", authUser.id)
        .maybeSingle();

      const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
      const fullName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
      const firstNameMeta = typeof metadata.first_name === "string" ? metadata.first_name.trim() : "";
      const lastNameMeta = typeof metadata.last_name === "string" ? metadata.last_name.trim() : "";

      const firstName = firstNameMeta || (fullName ? fullName.split(" ")[0] : null);
      const lastName = lastNameMeta || (fullName.includes(" ") ? fullName.split(" ").slice(1).join(" ") : null);

      if (existing) {
        const patch: Record<string, string | null> = {};
        if (!existing.email && authUser.email) patch.email = authUser.email;
        if (!existing.first_name && firstName) patch.first_name = firstName;
        if (!existing.last_name && lastName) patch.last_name = lastName;

        if (Object.keys(patch).length > 0) {
          await supabase
            .from("profiles")
            .update(patch)
            .eq("id", authUser.id)
            .select("id")
            .maybeSingle();
        }
        return;
      }

      const { error } = await supabase.from("profiles").insert({
        id: authUser.id,
        email: authUser.email ?? null,
        first_name: firstName || null,
        last_name: lastName || null,
      });

      if (error && error.code !== "23505") {
        console.warn("ensureProfile failed", error.message);
      }
    } catch (e) {
      console.warn("ensureProfile error", e);
    }
  }, []);

  const trackLogin = useCallback(async (userId: string) => {
    try {
      logLoginEvent(userId);
      const { data: profile } = await fromTable("profiles")
        .select("login_count")
        .eq("id", userId)
        .single();
      const currentCount = profile?.login_count ?? 0;
      await fromTable("profiles")
        .update({ last_login_at: new Date().toISOString(), login_count: currentCount + 1 })
        .eq("id", userId);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (event === "PASSWORD_RECOVERY") {
          setIsRecoveringPassword(true);
          if (typeof window !== "undefined" && window.location.pathname !== "/reset-password") {
            window.history.replaceState({}, "", "/reset-password");
            // Trigger react-router to pick up the new path
            window.dispatchEvent(new PopStateEvent("popstate"));
          }
        }
        if (session?.user) {
          void ensureProfile(session.user);
          if (event === "SIGNED_IN") {
            void trackLogin(session.user.id);
          }
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        void ensureProfile(session.user);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [ensureProfile, trackLogin]);

  // Check ban status when user changes
  useEffect(() => {
    if (!user) {
      setIsBanned(false);
      return;
    }
    const checkBan = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("is_banned")
          .eq("id", user.id)
          .single();
        setIsBanned(data?.is_banned ?? false);
      } catch {
        setIsBanned(false);
      }
    };
    checkBan();
  }, [user]);

  /**
   * Robust sign-out: always clears local state even if the network call fails.
   * This prevents the user from being stuck in a "logged in but broken" state.
   */
  const signOut = useCallback(async () => {
    const userId = user?.id;
    if (userId) {
      try { logLogoutEvent(userId); } catch { /* best effort */ }
    }

    // Clear local state FIRST so the UI reacts immediately
    setUser(null);
    setSession(null);
    setIsBanned(false);

    // Then attempt network sign-out (best effort)
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("[Auth] Network sign-out failed, local state already cleared:", e);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, session, loading, isBanned, isRecoveringPassword, clearRecoveryFlag: () => setIsRecoveringPassword(false), signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
