import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * If a Supabase PASSWORD_RECOVERY event was detected, force the user onto
 * /reset-password no matter where they landed. Without this, Supabase may
 * redirect them to the Site URL (/) and they end up logged in without
 * actually setting a new password.
 */
export function RecoveryGuard() {
  const { isRecoveringPassword } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isRecoveringPassword && location.pathname !== "/reset-password") {
      navigate("/reset-password", { replace: true });
    }
  }, [isRecoveringPassword, location.pathname, navigate]);

  return null;
}
