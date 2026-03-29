import { createContext, useContext, ReactNode } from "react";

interface ImpersonationContextType {
  isImpersonating: boolean;
  adminId: string | null;
  targetEmail: string | null;
}

const ImpersonationContext = createContext<ImpersonationContextType>({
  isImpersonating: false,
  adminId: null,
  targetEmail: null,
});

export function useImpersonation() {
  return useContext(ImpersonationContext);
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const isImpersonating = sessionStorage.getItem("impersonation_active") === "true";
  const adminId = sessionStorage.getItem("impersonation_admin_id");
  const targetEmail = sessionStorage.getItem("impersonation_target_email");

  return (
    <ImpersonationContext.Provider
      value={{ isImpersonating, adminId, targetEmail }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}
