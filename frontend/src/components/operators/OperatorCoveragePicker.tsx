/**
 * OperatorCoveragePicker — sélection multi-zones de couverture pour un opérateur.
 *
 * Pour chaque zone : Pays → Province (optionnel) → Ville → Communes desservies (multi)
 * → Quartiers desservis (multi cascading par commune cochée).
 *
 * Empêche la saisie libre : si la ville n'a pas de communes en base, on bloque
 * et on renvoie l'admin vers la gestion des zones géographiques.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CountryCombobox } from "@/components/vendor/CountryCombobox";
import { GeoCombobox } from "@/components/address/GeoCombobox";
import { useActiveGeo } from "@/hooks/useActiveGeo";
import { Plus, X, AlertCircle, MapPin, ExternalLink } from "lucide-react";

export type CoverageZone = {
  country_code: string;
  province_id: string | null;
  province_name: string | null;
  city: string;             // nom (clé d'usage côté run-time + rétro-compat)
  city_id: string | null;
  commune_ids: string[];    // au moins 1
  quartier_ids: string[];   // optionnel (vide = "tous les quartiers des communes")
};

const db = supabase as any;

type Props = {
  value: CoverageZone[];
  onChange: (v: CoverageZone[]) => void;
  /** Restreint l'admin aux pays activés sur la plateforme. */
  restrictToActiveCountries?: boolean;
};

export function OperatorCoveragePicker({ value, onChange, restrictToActiveCountries = true }: Props) {
  const update = (i: number, patch: Partial<CoverageZone>) =>
    onChange(value.map((z, idx) => idx === i ? { ...z, ...patch } : z));

  const remove = (i: number) =>
    onChange(value.filter((_, idx) => idx !== i));

  const add = () =>
    onChange([
      ...value,
      { country_code: "CD", province_id: null, province_name: null, city: "", city_id: null, commune_ids: [], quartier_ids: [] },
    ]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="flex items-center gap-2"><MapPin size={14} /> Couverture géographique *</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sélectionnez les pays, villes, communes et quartiers réellement desservis.
            Aucune saisie libre — toutes les zones doivent exister dans la plateforme.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={add} disabled={value.length >= 50}>
          <Plus size={14} /> Zone
        </Button>
      </div>

      {value.length === 0 && (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
          Aucune zone de couverture. Ajoutez-en au moins une.
        </div>
      )}

      <div className="space-y-3">
        {value.map((zone, i) => (
          <CoverageZoneRow
            key={i}
            index={i}
            zone={zone}
            onChange={(patch) => update(i, patch)}
            onRemove={() => remove(i)}
            restrictToActiveCountries={restrictToActiveCountries}
          />
        ))}
      </div>
    </div>
  );
}

function CoverageZoneRow({
  index, zone, onChange, onRemove, restrictToActiveCountries,
}: {
  index: number;
  zone: CoverageZone;
  onChange: (patch: Partial<CoverageZone>) => void;
  onRemove: () => void;
  restrictToActiveCountries: boolean;
}) {
  const { activeCountryCodes } = useActiveGeo();

  const [provinces, setProvinces] = useState<{ value: string; label: string }[]>([]);
  const [cities, setCities] = useState<{ value: string; label: string; id: string }[]>([]);
  const [communes, setCommunes] = useState<{ id: string; name: string }[]>([]);
  const [quartiersByCommune, setQuartiersByCommune] = useState<Record<string, { id: string; name: string }[]>>({});
  const [coverageStatus, setCoverageStatus] = useState<{ has_provinces: boolean; has_cities: boolean; has_communes: boolean } | null>(null);

  // Statut de couverture du pays
  useEffect(() => {
    if (!zone.country_code) { setCoverageStatus(null); return; }
    db.from("v_geo_coverage_status").select("*").eq("country_code", zone.country_code).maybeSingle()
      .then(({ data }: any) => setCoverageStatus(data || { has_provinces: false, has_cities: false, has_communes: false }));
  }, [zone.country_code]);

  // Provinces du pays
  useEffect(() => {
    if (!zone.country_code) { setProvinces([]); return; }
    db.from("provinces").select("id, name").eq("country_code", zone.country_code).order("name")
      .then(({ data }: any) => setProvinces((data || []).map((p: any) => ({ value: p.id, label: p.name }))));
  }, [zone.country_code]);

  // Villes (filtrées par province si choisie)
  useEffect(() => {
    if (!zone.country_code) { setCities([]); return; }
    let q = db.from("cities").select("id, name").eq("country_code", zone.country_code).eq("is_active", true).order("name").limit(500);
    if (zone.province_id) q = q.eq("province_id", zone.province_id);
    q.then(({ data }: any) => setCities((data || []).map((c: any) => ({ value: c.name, label: c.name, id: c.id }))));
  }, [zone.country_code, zone.province_id]);

  // Communes de la ville sélectionnée
  useEffect(() => {
    if (!zone.city || !zone.country_code) { setCommunes([]); return; }
    db.from("communes")
      .select("id, name")
      .eq("city", zone.city)
      .eq("country_code", zone.country_code)
      .eq("is_active", true)
      .order("name")
      .then(({ data }: any) => setCommunes((data || []) as { id: string; name: string }[]));
  }, [zone.city, zone.country_code]);

  // Quartiers pour chaque commune cochée
  useEffect(() => {
    if (zone.commune_ids.length === 0) { setQuartiersByCommune({}); return; }
    db.from("quartiers")
      .select("id, name, commune_id, is_restricted")
      .in("commune_id", zone.commune_ids)
      .eq("is_active", true)
      .order("name")
      .then(({ data }: any) => {
        const map: Record<string, { id: string; name: string }[]> = {};
        (data || []).forEach((q: any) => {
          if (q.is_restricted) return;
          map[q.commune_id] ||= [];
          map[q.commune_id].push({ id: q.id, name: q.name });
        });
        setQuartiersByCommune(map);
      });
  }, [zone.commune_ids.join(",")]);

  const handleCountry = (code: string) => {
    onChange({ country_code: code, province_id: null, province_name: null, city: "", city_id: null, commune_ids: [], quartier_ids: [] });
  };
  const handleProvince = (id: string) => {
    const p = provinces.find(x => x.value === id);
    onChange({ province_id: id || null, province_name: p?.label || null, city: "", city_id: null, commune_ids: [], quartier_ids: [] });
  };
  const handleCity = (name: string) => {
    const c = cities.find(x => x.value === name);
    onChange({ city: name, city_id: c?.id || null, commune_ids: [], quartier_ids: [] });
  };
  const toggleCommune = (id: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...zone.commune_ids, id]))
      : zone.commune_ids.filter(x => x !== id);
    // Si on décoche une commune, on retire aussi ses quartiers
    const removedQuartiers = (quartiersByCommune[id] || []).map(q => q.id);
    const nextQuartiers = checked
      ? zone.quartier_ids
      : zone.quartier_ids.filter(qid => !removedQuartiers.includes(qid));
    onChange({ commune_ids: next, quartier_ids: nextQuartiers });
  };
  const toggleQuartier = (id: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...zone.quartier_ids, id]))
      : zone.quartier_ids.filter(x => x !== id);
    onChange({ quartier_ids: next });
  };

  const noCitiesForCountry = coverageStatus !== null && !coverageStatus.has_cities;
  const noCommunesForCity = zone.city && communes.length === 0;

  return (
    <div className="border border-border rounded-md p-3 space-y-3 bg-card/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Zone #{index + 1}</span>
        <Button type="button" size="icon" variant="ghost" onClick={onRemove} aria-label="Retirer la zone">
          <X size={14} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <CountryCombobox
            label="Pays *"
            value={zone.country_code}
            onChange={handleCountry}
            showNone={false}
            allowedCodes={restrictToActiveCountries ? activeCountryCodes : undefined}
          />
        </div>
        <div>
          <GeoCombobox
            label={`Province ${provinces.length === 0 ? "(non requise)" : "(si applicable)"}`}
            options={provinces}
            value={zone.province_id || ""}
            onChange={handleProvince}
            placeholder={provinces.length === 0 ? "Aucune province enregistrée" : "Sélectionner..."}
            disabled={provinces.length === 0}
          />
        </div>
      </div>

      {noCitiesForCountry ? (
        <CoverageBlocked
          title="Aucune ville active pour ce pays"
          message="La plateforme n'a pas encore enregistré de villes pour ce pays. Ajoutez-les avant de créer un opérateur ici."
        />
      ) : (
        <div>
          <GeoCombobox
            label="Ville *"
            options={cities.map(c => ({ value: c.value, label: c.label }))}
            value={zone.city}
            onChange={handleCity}
            placeholder={cities.length === 0 ? "Chargement..." : "Sélectionner une ville..."}
            disabled={cities.length === 0}
          />
        </div>
      )}

      {zone.city && (
        noCommunesForCity ? (
          <CoverageBlocked
            title="Aucune commune enregistrée pour cette ville"
            message="Avant qu'un opérateur puisse couvrir cette ville, créez ses communes dans la gestion des zones géographiques."
          />
        ) : (
          <div className="space-y-2">
            <Label className="text-xs">Communes desservies *</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto p-2 border border-border rounded-md bg-background">
              {communes.map((c) => {
                const checked = zone.commune_ids.includes(c.id);
                return (
                  <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                    <Checkbox checked={checked} onCheckedChange={(v) => toggleCommune(c.id, !!v)} />
                    <span className="truncate">{c.name}</span>
                  </label>
                );
              })}
            </div>
            {zone.commune_ids.length === 0 && (
              <p className="text-[11px] text-amber-600 flex items-center gap-1">
                <AlertCircle size={11} /> Cochez au moins une commune.
              </p>
            )}

            {zone.commune_ids.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs">Quartiers spécifiques (optionnel)</Label>
                <p className="text-[11px] text-muted-foreground">
                  Vide = tous les quartiers des communes cochées sont desservis. Cocher = restriction explicite.
                </p>
                {zone.commune_ids.map(cid => {
                  const commune = communes.find(c => c.id === cid);
                  const qList = quartiersByCommune[cid] || [];
                  if (qList.length === 0) return null;
                  return (
                    <div key={cid} className="rounded-md border border-border p-2">
                      <div className="text-xs font-medium mb-1.5 flex items-center gap-2">
                        {commune?.name}
                        <Badge variant="outline" className="text-[10px]">{qList.length} quartier(s)</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                        {qList.map(q => {
                          const checked = zone.quartier_ids.includes(q.id);
                          return (
                            <label key={q.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                              <Checkbox checked={checked} onCheckedChange={(v) => toggleQuartier(q.id, !!v)} />
                              <span className="truncate">{q.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

function CoverageBlocked({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
      <div className="flex items-start gap-2">
        <AlertCircle size={14} className="mt-0.5 text-amber-600 shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-amber-900 dark:text-amber-200">{title}</p>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-0.5">{message}</p>
          <Link
            to="/admin/geography"
            className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-amber-900 dark:text-amber-200 underline"
          >
            Gérer les zones géographiques <ExternalLink size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Validation pour le formulaire parent. */
export function validateCoverage(zones: CoverageZone[]): string | null {
  if (zones.length === 0) return "Au moins une zone de couverture est requise.";
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (!z.country_code) return `Zone #${i + 1} : pays manquant.`;
    if (!z.city) return `Zone #${i + 1} : ville manquante.`;
    if (z.commune_ids.length === 0) return `Zone #${i + 1} : sélectionnez au moins une commune.`;
  }
  return null;
}