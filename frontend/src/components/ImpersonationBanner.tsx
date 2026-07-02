import { useState } from "react";
import { X, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { throwIfEdgeFunctionError } from "@/services/admin-email";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function ImpersonationBanner() {
  const isActive = sessionStorage.getItem("impersonation_active") === "true";
  const [restoring, setRestoring] = useState(false);
  const navigate = useNavigate();

  if (!isActive) return null;

  const targetEmail = sessionStorage.getItem("impersonation_target_email") || "utilisateur";

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const adminAccessToken = sessionStorage.getItem("impersonation_admin_access_token");
      const adminRefreshToken = sessionStorage.getItem("impersonation_admin_refresh_token");

      if (!adminAccessToken || !adminRefreshToken) {
        throw new Error("Tokens admin introuvables. Veuillez vous reconnecter.");
      }

      const res = await supabase.functions.invoke("impersonate-user", {
        body: {
          action: "restore",
          adminAccessToken,
          adminRefreshToken,
        },
      });

      await throwIfEdgeFunctionError(res);

      // Restore admin session
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: res.data.session.access_token,
        refresh_token: res.data.session.refresh_token,
      });

      if (setSessionError) throw setSessionError;

      // Clear all impersonation data
      sessionStorage.removeItem("impersonation_active");
      sessionStorage.removeItem("impersonation_admin_id");
      sessionStorage.removeItem("impersonation_target_id");
      sessionStorage.removeItem("impersonation_target_email");
      sessionStorage.removeItem("impersonation_admin_access_token");
      sessionStorage.removeItem("impersonation_admin_refresh_token");

      toast.success("Session admin restaurée");
      navigate("/admin/users", { replace: true });
    } catch (e: any) {
      console.error("Restore failed:", e);
      toast.error(e.message || "Échec de la restauration");
      setRestoring(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium shadow-lg">
      <span className="flex items-center gap-2">
        <ShieldAlert size={16} />
        Session admin — connecté en tant que <strong>{targetEmail}</strong>
      </span>
      <button
        onClick={handleRestore}
        disabled={restoring}
        className="flex items-center gap-1.5 px-3 py-1 bg-amber-700 text-white rounded-md hover:bg-amber-800 transition-colors text-xs font-bold disabled:opacity-50"
      >
        {restoring ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
        Revenir en tant qu'admin
      </button>
    </div>
  );
}
