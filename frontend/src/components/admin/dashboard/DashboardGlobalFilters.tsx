import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface GlobalFilters {
  country: string;
  city: string;
}

interface Props {
  value: GlobalFilters;
  onChange: (v: GlobalFilters) => void;
}

export function DashboardGlobalFilters({ value, onChange }: Props) {
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("cities").select("country_code").then(({ data }) => {
      if (data) {
        const unique = [...new Set(data.map((c) => c.country_code))].sort();
        setCountries(unique);
      }
    });
  }, []);

  useEffect(() => {
    if (!value.country || value.country === "all") {
      setCities([]);
      return;
    }
    supabase.from("cities").select("name").eq("country_code", value.country).then(({ data }) => {
      if (data) setCities([...new Set(data.map((c) => c.name))].sort());
    });
  }, [value.country]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        <Globe size={14} className="text-muted-foreground" />
        <Select
          value={value.country}
          onValueChange={(v) => onChange({ country: v, city: "all" })}
        >
          <SelectTrigger className="w-[120px] h-9 text-sm">
            <SelectValue placeholder="Pays" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les pays</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.country && value.country !== "all" && cities.length > 0 && (
        <div className="flex items-center gap-1.5">
          <MapPin size={14} className="text-muted-foreground" />
          <Select
            value={value.city}
            onValueChange={(v) => onChange({ ...value, city: v })}
          >
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder="Ville" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les villes</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
