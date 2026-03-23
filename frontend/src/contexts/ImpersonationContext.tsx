import { createContext, useContext, useState, ReactNode } from "react";
import { X } from "lucide-react";

interface ImpersonatedUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  roles: string[];
  orders: any[];
  stats: {
    total_orders: number;
    total_spent: number;
    total_delivered: number;
  };
  addresses: any[];
  wallet: any | null;
  payment_methods: any[];
}

interface ImpersonationContextType {
  impersonatedUser: ImpersonatedUser | null;
  startImpersonation: (user: ImpersonatedUser) => void;
  stopImpersonation: () => void;
  isImpersonating: boolean;
}

const ImpersonationContext = createContext<ImpersonationContextType>({
  impersonatedUser: null,
  startImpersonation: () => {},
  stopImpersonation: () => {},
  isImpersonating: false,
});

export function useImpersonation() {
  return useContext(ImpersonationContext);
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);

  const startImpersonation = (user: ImpersonatedUser) => {
    setImpersonatedUser(user);
  };

  const stopImpersonation = () => {
    setImpersonatedUser(null);
  };

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUser,
        startImpersonation,
        stopImpersonation,
        isImpersonating: !!impersonatedUser,
      }}
    >
      {impersonatedUser && <ImpersonationBanner user={impersonatedUser} onStop={stopImpersonation} />}
      {children}
    </ImpersonationContext.Provider>
  );
}

function ImpersonationBanner({ user, onStop }: { user: ImpersonatedUser; onStop: () => void }) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium shadow-lg">
      <span>
        👁 Mode impersonation — Vous consultez le compte de <strong>{name}</strong> (lecture seule)
      </span>
      <button
        onClick={onStop}
        className="flex items-center gap-1.5 px-3 py-1 bg-amber-700 text-white rounded-md hover:bg-amber-800 transition-colors text-xs font-bold"
      >
        <X size={12} /> Quitter
      </button>
    </div>
  );
}
