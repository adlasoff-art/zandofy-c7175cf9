import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MobileAccountMenu } from "@/components/MobileAccountMenu";
import { SEOHead } from "@/components/SEOHead";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";

export default function AccountPage() {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <>
      <SEOHead title="Mon compte" description="Espace compte Zandofy." canonical="/account" noindex />
      <div className="container pt-3 pb-0">
        <ProfileCompletionBanner />
      </div>
      <MobileAccountMenu />
    </>
  );
}
