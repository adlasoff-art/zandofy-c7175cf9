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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isBanned: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);

  const ensureProfile = useCallback(async (authUser: User) => {
    // Only INSERT if profile doesn't exist yet — never overwrite existing data
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", authUser.id)
      .maybeSingle();

    if (existing) return; // Profile already exists, don't overwrite

    const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
    const fullName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
    const firstNameMeta = typeof metadata.first_name === "string" ? metadata.first_name.trim() : "";
    const lastNameMeta = typeof metadata.last_name === "string" ? metadata.last_name.trim() : "";

    const firstName = firstNameMeta || (fullName ? fullName.split(" ")[0] : null);
    const lastName = lastNameMeta || (fullName.includes(" ") ? fullName.split(" ").slice(1).join(" ") : null);

    const { error } = await supabase.from("profiles").insert({
      id: authUser.id,
      email: authUser.email ?? null,
      first_name: firstName || null,
      last_name: lastName || null,
    });

    if (error && error.code !== "23505") {
      // 23505 = unique violation (profile already exists via trigger) — ignore
      console.warn("ensureProfile failed", error.message);
    }
  }, []);

  // Update last_login_at and login_count on login
  const trackLogin = useCallback(async (userId: string) => {
    try {
      logLoginEvent(userId);
      await fromTable("profiles")
        .update({ last_login_at: new Date().toISOString(), login_count: (await fromTable("profiles").select("login_count").eq("id", userId).single()).data?.login_count + 1 || 1 })
        .eq("id", userId);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
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
    supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setIsBanned(data?.is_banned ?? false);
      });
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isBanned, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
