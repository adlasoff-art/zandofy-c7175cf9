import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MobileAccountMenu } from "@/components/MobileAccountMenu";

export default function AccountPage() {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  return <MobileAccountMenu />;
}
