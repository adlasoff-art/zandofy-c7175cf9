import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { SEOHead } from "@/components/SEOHead";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <SEOHead
        title="Page introuvable | Zandofy"
        description="Cette page n'existe pas sur Zandofy."
        canonical={location.pathname}
        noindex
      />
      <div className="text-center px-4">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Page introuvable</p>
        <Link to="/" className="text-primary underline hover:text-primary/90">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
