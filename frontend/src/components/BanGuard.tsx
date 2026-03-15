import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const EXEMPT_PATHS = ["/banned", "/auth", "/reset-password", "/help-center"];

export function BanGuard({ children }: { children: ReactNode }) {
  const { isBanned, user } = useAuth();
  const location = useLocation();

  if (user && isBanned && !EXEMPT_PATHS.includes(location.pathname)) {
    return <Navigate to="/banned" replace />;
  }

  return <>{children}</>;
}
