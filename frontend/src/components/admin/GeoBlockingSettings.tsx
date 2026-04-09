import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, Save, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const ALL_COUNTRIES = [
  { code: "AF", name: "Afghanistan" }, { code: "AL", name: "Albanie" }, { code: "DZ", name: "Algérie" },
  { code: "AO", name: "Angola" }, { code: "AR", name: "Argentine" }, { code: "AM", name: "Arménie" },
  { code: "AU", name: "Australie" }, { code: "AT", name: "Autriche" }, { code: "AZ", name: "Azerbaïdjan" },
  { code: "BD", name: "Bangladesh" }, { code: "BY", name: "Biélorussie" }, { code: "BE", name: "Belgique" },
  { code: "BJ", name: "Bénin" }, { code: "BO", name: "Bolivie" }, { code: "BA", name: "Bosnie" },
  { code: "BR", name: "Brésil" }, { code: "BG", name: "Bulgarie" }, { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" }, { code: "KH", name: "Cambodge" }, { code: "CM", name: "Cameroun" },
  { code: "CA", name: "Canada" }, { code: "CF", name: "Centrafrique" }, { code: "TD", name: "Tchad" },
  { code: "CL", name: "Chili" }, { code: "CN", name: "Chine" }, { code: "CO", name: "Colombie" },
  { code: "CG", name: "Congo" }, { code: "CD", name: "RD Congo" }, { code: "CR", name: "Costa Rica" },
  { code: "CI", name: "Côte d'Ivoire" }, { code: "HR", name: "Croatie" }, { code: "CU", name: "Cuba" },
  { code: "CZ", name: "Tchéquie" }, { code: "DK", name: "Danemark" }, { code: "DJ", name: "Djibouti" },
  { code: "EC", name: "Équateur" }, { code: "EG", name: "Égypte" }, { code: "ER", name: "Érythrée" },
  { code: "ET", name: "Éthiopie" }, { code: "FI", name: "Finlande" }, { code: "FR", name: "France" },
  { code: "GA", name: "Gabon" }, { code: "DE", name: "Allemagne" }, { code: "GH", name: "Ghana" },
  { code: "GR", name: "Grèce" }, { code: "GN", name: "Guinée" }, { code: "HT", name: "Haïti" },
  { code: "HN", name: "Honduras" }, { code: "HU", name: "Hongrie" }, { code: "IN", name: "Inde" },
  { code: "ID", name: "Indonésie" }, { code: "IR", name: "Iran" }, { code: "IQ", name: "Irak" },
  { code: "IE", name: "Irlande" }, { code: "IL", name: "Israël" }, { code: "IT", name: "Italie" },
  { code: "JP", name: "Japon" }, { code: "JO", name: "Jordanie" }, { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" }, { code: "KP", name: "Corée du Nord" }, { code: "KR", name: "Corée du Sud" },
  { code: "KW", name: "Koweït" }, { code: "LB", name: "Liban" }, { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libye" }, { code: "MG", name: "Madagascar" }, { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaisie" }, { code: "ML", name: "Mali" }, { code: "MX", name: "Mexique" },
  { code: "MA", name: "Maroc" }, { code: "MZ", name: "Mozambique" }, { code: "MM", name: "Myanmar" },
  { code: "NP", name: "Népal" }, { code: "NL", name: "Pays-Bas" }, { code: "NZ", name: "Nouvelle-Zélande" },
  { code: "NE", name: "Niger" }, { code: "NG", name: "Nigeria" }, { code: "NO", name: "Norvège" },
  { code: "PK", name: "Pakistan" }, { code: "PE", name: "Pérou" }, { code: "PH", name: "Philippines" },
  { code: "PL", name: "Pologne" }, { code: "PT", name: "Portugal" }, { code: "RO", name: "Roumanie" },
  { code: "RU", name: "Russie" }, { code: "RW", name: "Rwanda" }, { code: "SA", name: "Arabie Saoudite" },
  { code: "SN", name: "Sénégal" }, { code: "RS", name: "Serbie" }, { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapour" }, { code: "SO", name: "Somalie" }, { code: "ZA", name: "Afrique du Sud" },
  { code: "ES", name: "Espagne" }, { code: "LK", name: "Sri Lanka" }, { code: "SD", name: "Soudan" },
  { code: "SE", name: "Suède" }, { code: "CH", name: "Suisse" }, { code: "SY", name: "Syrie" },
  { code: "TW", name: "Taïwan" }, { code: "TZ", name: "Tanzanie" }, { code: "TH", name: "Thaïlande" },
  { code: "TG", name: "Togo" }, { code: "TN", name: "Tunisie" }, { code: "TR", name: "Turquie" },
  { code: "UG", name: "Ouganda" }, { code: "UA", name: "Ukraine" }, { code: "AE", name: "Émirats Arabes Unis" },
  { code: "GB", name: "Royaume-Uni" }, { code: "US", name: "États-Unis" }, { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Ouzbékistan" }, { code: "VE", name: "Venezuela" }, { code: "VN", name: "Vietnam" },
  { code: "YE", name: "Yémen" }, { code: "ZM", name: "Zambie" }, { code: "ZW", name: "Zimbabwe" },
];

export function GeoBlockingSettings() {
  const [blocked, setBlocked] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "geo_blocked_countries")
      .maybeSingle()
      .then(({ data }) => {
        const val = data?.value as any;
        if (val?.blocked && Array.isArray(val.blocked)) {
          setBlocked(val.blocked);
        }
      });
  }, []);

  const toggle = (code: string) => {
    setBlocked((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .upsert(
        {
          key: "geo_blocked_countries",
          value: { blocked } as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sauvegardé", description: `${blocked.length} pays bloqué(s).` });
    }
    setSaving(false);
  };

  const filtered = ALL_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="bg-card border-2 border-destructive/30 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={18} className="text-destructive" />
        <h2 className="text-sm font-semibold text-foreground">
          Blocage géographique
        </h2>
        {blocked.length > 0 && (
          <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
            {blocked.length} pays bloqué(s)
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Les visiteurs des pays cochés verront un écran "Site inaccessible" et ne
        pourront pas accéder à la plateforme.
      </p>

      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un pays..."
          className="pl-9 h-8 text-sm"
        />
      </div>

      <div className="max-h-60 overflow-y-auto border border-border rounded-lg p-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
        {filtered.map((c) => (
          <label
            key={c.code}
            className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer hover:bg-muted/50 transition-colors ${
              blocked.includes(c.code) ? "bg-destructive/10 text-destructive font-medium" : "text-foreground"
            }`}
          >
            <input
              type="checkbox"
              checked={blocked.includes(c.code)}
              onChange={() => toggle(c.code)}
              className="rounded border-border"
            />
            <span>{c.code}</span>
            <span className="truncate">{c.name}</span>
          </label>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-3 flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground text-xs font-medium rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Enregistrer le blocage
      </button>
    </section>
  );
}
