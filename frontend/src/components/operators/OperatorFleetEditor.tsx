/**
 * OperatorFleetEditor — édite la flotte détaillée (type + plaque obligatoire).
 * Validation : minimum 3 véhicules, plaques uniques.
 */
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, AlertCircle, Truck } from "lucide-react";

export type FleetVehicle = {
  type: string;
  plate_number: string;
  brand?: string;
  model?: string;
};

const VEHICLE_TYPES = [
  { value: "moto", label: "Moto" },
  { value: "voiture", label: "Voiture" },
  { value: "tricycle", label: "Tricycle" },
  { value: "camionnette", label: "Camionnette" },
  { value: "velo", label: "Vélo" },
];

export const MIN_FLEET = 3;

type Props = {
  value: FleetVehicle[];
  onChange: (v: FleetVehicle[]) => void;
};

export function OperatorFleetEditor({ value, onChange }: Props) {
  const update = (i: number, patch: Partial<FleetVehicle>) =>
    onChange(value.map((v, idx) => idx === i ? { ...v, ...patch } : v));

  const remove = (i: number) =>
    onChange(value.filter((_, idx) => idx !== i));

  const add = () =>
    onChange([...value, { type: "moto", plate_number: "", brand: "", model: "" }]);

  // Statistiques
  const counts = value.reduce<Record<string, number>>((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(counts)
    .map(([t, n]) => `${n} ${VEHICLE_TYPES.find(x => x.value === t)?.label.toLowerCase() || t}${n > 1 ? "s" : ""}`)
    .join(", ");

  // Détection doublons de plaques
  const plates = value.map(v => v.plate_number.trim().toUpperCase()).filter(Boolean);
  const dupSet = new Set(plates.filter((p, i) => plates.indexOf(p) !== i));

  const missingCount = Math.max(0, MIN_FLEET - value.length);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="flex items-center gap-2">
            <Truck size={14} /> Flotte déclarée *
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Minimum {MIN_FLEET} véhicules. Plaque d'immatriculation obligatoire pour chaque véhicule.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus size={14} /> Ajouter
        </Button>
      </div>

      <div className="space-y-2">
        {value.length === 0 && (
          <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
            Aucun véhicule. Ajoutez au moins {MIN_FLEET} véhicules avec leur plaque.
          </div>
        )}
        {value.map((v, i) => {
          const plate = v.plate_number.trim().toUpperCase();
          const isDup = plate && dupSet.has(plate);
          const isEmpty = plate.length === 0;
          return (
            <div
              key={i}
              className={`grid grid-cols-12 gap-2 p-2 rounded-md border ${isDup ? "border-destructive/60 bg-destructive/5" : "border-border"}`}
            >
              <select
                className="col-span-3 h-10 rounded-md border border-input bg-background px-2 text-sm"
                value={v.type}
                onChange={(e) => update(i, { type: e.target.value })}
              >
                {VEHICLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <Input
                className={`col-span-3 ${isEmpty ? "border-amber-500" : ""}`}
                placeholder="Plaque *"
                value={v.plate_number}
                onChange={(e) => update(i, { plate_number: e.target.value.toUpperCase() })}
                maxLength={20}
              />
              <Input
                className="col-span-3"
                placeholder="Marque (opt.)"
                value={v.brand ?? ""}
                onChange={(e) => update(i, { brand: e.target.value })}
                maxLength={40}
              />
              <Input
                className="col-span-2"
                placeholder="Modèle"
                value={v.model ?? ""}
                onChange={(e) => update(i, { model: e.target.value })}
                maxLength={40}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="col-span-1 self-center"
                onClick={() => remove(i)}
                aria-label="Retirer"
              >
                <X size={14} />
              </Button>
              {isDup && (
                <p className="col-span-12 text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle size={11} /> Plaque dupliquée dans cette liste.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className={missingCount > 0 ? "text-amber-600" : "text-muted-foreground"}>
          {missingCount > 0
            ? `Encore ${missingCount} véhicule${missingCount > 1 ? "s" : ""} requis (min ${MIN_FLEET}).`
            : `Total : ${value.length} véhicules${summary ? ` · ${summary}` : ""}`}
        </span>
        {dupSet.size > 0 && (
          <span className="text-destructive flex items-center gap-1">
            <AlertCircle size={11} /> {dupSet.size} plaque(s) dupliquée(s)
          </span>
        )}
      </div>
    </div>
  );
}

export function validateFleet(fleet: FleetVehicle[]): string | null {
  if (fleet.length < MIN_FLEET) return `Au moins ${MIN_FLEET} véhicules requis.`;
  const plates: string[] = [];
  for (const v of fleet) {
    const p = v.plate_number.trim().toUpperCase();
    if (!p || p.length < 3) return "Chaque véhicule doit avoir une plaque (min 3 caractères).";
    if (!v.type) return "Chaque véhicule doit avoir un type.";
    if (plates.includes(p)) return `Plaque dupliquée : ${p}`;
    plates.push(p);
  }
  return null;
}

/** Dérive le format legacy [{type,count}] depuis fleet_vehicles pour rétro-compat. */
export function deriveVehicleTypes(fleet: FleetVehicle[]): { type: string; count: number }[] {
  const m: Record<string, number> = {};
  for (const v of fleet) m[v.type] = (m[v.type] || 0) + 1;
  return Object.entries(m).map(([type, count]) => ({ type, count }));
}