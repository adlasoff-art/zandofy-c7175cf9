/**
 * ForwarderCoveragePage — édition coverage_routes (jsonb sur forwarders).
 */
import { useState, useEffect } from "react";
import { useForwarderContext } from "@/hooks/use-forwarder-context";
import { fromTable } from "@/lib/supabase-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, Map } from "lucide-react";

type Route = { origin?: string; destination?: string; mode?: string };

export default function ForwarderCoveragePage() {
  const { forwarder, refetch } = useForwarderContext();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRoutes(Array.isArray(forwarder?.coverage_routes) ? forwarder!.coverage_routes : []);
  }, [forwarder]);

  if (!forwarder) return null;

  const update = (i: number, patch: Partial<Route>) =>
    setRoutes(routes.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () => setRoutes([...routes, { origin: "", destination: "", mode: "road" }]);
  const remove = (i: number) => setRoutes(routes.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    const { error } = await fromTable("forwarders")
      .update({ coverage_routes: routes }).eq("id", forwarder.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Routes enregistrées"); refetch(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Couverture & routes</h1>
          <p className="text-sm text-muted-foreground">Origine → destination et mode opéré.</p>
        </div>
        <Button onClick={save} disabled={saving} style={{ background: "var(--forwarder-gradient)" }} className="text-white">
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Enregistrer
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-2">
          {routes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune route. Ajoutez vos couples origine → destination.
            </p>
          )}
          {routes.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4">
                <Label className="text-[10px]">Origine</Label>
                <Input value={r.origin ?? ""} onChange={(e) => update(i, { origin: e.target.value })} placeholder="Shenzhen, CN" />
              </div>
              <div className="col-span-4">
                <Label className="text-[10px]">Destination</Label>
                <Input value={r.destination ?? ""} onChange={(e) => update(i, { destination: e.target.value })} placeholder="Kinshasa, CD" />
              </div>
              <div className="col-span-3">
                <Label className="text-[10px]">Mode</Label>
                <select value={r.mode ?? "road"} onChange={(e) => update(i, { mode: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                  {["air", "sea", "road", "rail"].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                </select>
              </div>
              <div className="col-span-1">
                <Button size="icon" variant="ghost" onClick={() => remove(i)}>
                  <Trash2 size={14} className="text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={add} className="mt-2">
            <Plus size={14} /> Ajouter une route
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-md text-xs text-muted-foreground">
        <Map size={14} className="mt-0.5 shrink-0 text-[hsl(var(--forwarder-primary))]" />
        Les restrictions douanières (catégories interdites par pays) sont gérées par l'équipe Zandofy.
        Contactez le support pour toute mise à jour.
      </div>
    </div>
  );
}