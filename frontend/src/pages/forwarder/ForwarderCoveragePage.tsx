/**
 * ForwarderCoveragePage — coverage_routes editor (shared with admin MapPin).
 */
import { useForwarderContext } from "@/hooks/use-forwarder-context";
import { CoverageRoutesEditor } from "@/components/forwarder/CoverageRoutesEditor";

export default function ForwarderCoveragePage() {
  const { forwarder, refetch } = useForwarderContext();

  if (!forwarder) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Couverture & routes</h1>
        <p className="text-sm text-muted-foreground">
          Origine → destination (pays / ville) et mode opéré — même donnée que l&apos;admin (MapPin).
        </p>
      </div>
      <CoverageRoutesEditor
        forwarderId={forwarder.id}
        initialRoutes={(forwarder.coverage_routes as any) || []}
        onSaved={() => refetch()}
      />
    </div>
  );
}
