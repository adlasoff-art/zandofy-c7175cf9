/**
 * ForwarderHandoffsPage — Affinage UX /forwarder/* (Phase B2.2)
 *
 * Liste des handoffs reçus pour le transitaire courant.
 * Délègue le rendu et les actions au panel partagé existant
 * (`ForwarderHandoffsPanel`) qui s'appuie sur RLS pour le filtrage.
 */
import { ArrowLeftRight } from "lucide-react";
import ForwarderHandoffsPanel from "@/components/forwarder/ForwarderHandoffsPanel";
import { useForwarderContext } from "@/hooks/use-forwarder-context";

export default function ForwarderHandoffsPage() {
  const { forwarder } = useForwarderContext();
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center"
          style={{ background: "var(--forwarder-gradient)" }}
        >
          <ArrowLeftRight size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Handoffs</h1>
          <p className="text-xs text-muted-foreground">
            Commandes confiées à {forwarder?.name ?? "votre entité"} par les vendeurs.
          </p>
        </div>
      </header>
      <ForwarderHandoffsPanel />
    </div>
  );
}