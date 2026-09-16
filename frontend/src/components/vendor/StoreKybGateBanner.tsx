import { Link } from "react-router-dom";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useStoreKybGate } from "@/hooks/use-store-kyb-gate";

interface Props {
  storeId: string;
  /** Where the CTA should point (vendor tab). */
  kybHref?: string;
}

export function StoreKybGateBanner({ storeId, kybHref = "/vendor?tab=kyb" }: Props) {
  const { data: gate } = useStoreKybGate(storeId);
  if (!gate || gate.exempt) return null;

  if (gate.blocked) {
    return (
      <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-xs space-y-1">
        <p className="font-semibold text-destructive flex items-center gap-1.5">
          <AlertTriangle size={14} /> Vérification entreprise (KYB) requise
        </p>
        <p className="text-muted-foreground">
          Vos ventes livrées (${Number(gate.gmv ?? 0).toFixed(0)}) ont atteint le seuil
          (${Number(gate.threshold ?? 0).toFixed(0)}). Catalogue, promos et retraits sont
          temporairement bloqués jusqu&apos;à approbation KYB. Commandes et litiges restent actifs.
        </p>
        <Link to={kybHref} className="inline-flex items-center gap-1 text-primary font-medium underline-offset-2 hover:underline">
          <ShieldCheck size={12} /> Compléter le dossier KYB
        </Link>
      </div>
    );
  }

  if (gate.soft_warn) {
    return (
      <div className="p-3 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-900/10 text-xs space-y-1">
        <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
          <AlertTriangle size={14} /> Seuil KYB approche
        </p>
        <p className="text-muted-foreground">
          Ventes livrées : ${Number(gate.gmv ?? 0).toFixed(0)} / ${Number(gate.threshold ?? 0).toFixed(0)}.
          Préparez votre dossier entreprise pour éviter un blocage catalogue / retraits.
        </p>
        <Link to={kybHref} className="inline-flex items-center gap-1 text-primary font-medium underline-offset-2 hover:underline">
          <ShieldCheck size={12} /> Préparer le KYB
        </Link>
      </div>
    );
  }

  return null;
}
