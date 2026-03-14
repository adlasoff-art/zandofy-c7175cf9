import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

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

  const ensureProfile = async (authUser: User) => {
    const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
    const fullName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
    const firstNameMeta = typeof metadata.first_name === "string" ? metadata.first_name.trim() : "";
    const lastNameMeta = typeof metadata.last_name === "string" ? metadata.last_name.trim() : "";

    const firstName = firstNameMeta || (fullName ? fullName.split(" ")[0] : null);
    const lastName = lastNameMeta || (fullName.includes(" ") ? fullName.split(" ").slice(1).join(" ") : null);

    const { error } = await supabase.from("profiles").upsert(
      {
        id: authUser.id,
        email: authUser.email ?? null,
        first_name: firstName || null,
        last_name: lastName || null,
      },
      { onConflict: "id" }
    );

    if (error) {
      console.warn("ensureProfile failed", error.message);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          void ensureProfile(session.user);
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
      // Handle LockManager timeout gracefully
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
