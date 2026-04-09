import { ShieldOff } from "lucide-react";

/**
 * Full-screen blocking page shown when the visitor's country is geo-blocked.
 */
export function GeoBlockScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      <div className="text-center px-6 max-w-md">
        <ShieldOff className="mx-auto mb-6 text-destructive" size={64} />
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Site inaccessible
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Ce site n'est pas disponible dans votre région. Si vous pensez qu'il
          s'agit d'une erreur, veuillez nous contacter à{" "}
          <a
            href="mailto:support@zandofy.com"
            className="text-primary underline"
          >
            support@zandofy.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
