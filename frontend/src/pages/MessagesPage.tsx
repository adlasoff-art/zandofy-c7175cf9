import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

/** Legacy /messages route — single UX is dashboard tab messages. */
export default function MessagesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
    navigate("/dashboard?tab=messages", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <Loader2 className="animate-spin text-primary" size={24} />
    </div>
  );
}
