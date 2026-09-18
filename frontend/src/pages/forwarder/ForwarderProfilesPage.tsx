/**
 * ForwarderProfilesPage — full parity with admin $ pricing editor (same tables).
 */
import { useForwarderContext } from "@/hooks/use-forwarder-context";
import { ForwarderPricingProfilesPanel } from "@/components/forwarder/ForwarderPricingProfilesPanel";

export default function ForwarderProfilesPage() {
  const { forwarder } = useForwarderContext();

  if (!forwarder) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tarifs</h1>
        <p className="text-sm text-muted-foreground">
          Mêmes grilles que l&apos;admin (ville, pickup, kg / pièce / CBM, groupage, restrictions).
          Toute modification est immédiatement visible côté admin et au checkout.
        </p>
      </div>
      <ForwarderPricingProfilesPanel
        forwarderId={forwarder.id}
        extraInvalidateKeys={[
          ["forwarder-profiles-for-shipments", forwarder.id],
          ["forwarder-dash-profiles", forwarder.id],
        ]}
        showTransporterOverride={false}
        requireCityOnCreate
      />
    </div>
  );
}
