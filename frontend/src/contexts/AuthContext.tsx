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
        const { error } = await supabase
          .from("profiles")
          .update(patch)
          .eq("id", authUser.id)
          .select("id")
          .maybeSingle();

        if (error) {
          console.warn("ensureProfile backfill failed", error.message);
        }
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
      // 23505 = unique violation (profile already exists via trigger) — ignore
      console.warn("ensureProfile failed", error.message);
    }
  }, []);

  // Update last_login_at and login_count on login (atomic increment via RPC-style)
  const trackLogin = useCallback(async (userId: string) => {
    try {
      logLoginEvent(userId);
      // First read current count, then update — two separate calls to avoid race
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
    if (user?.id) logLogoutEvent(user.id);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isBanned, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
