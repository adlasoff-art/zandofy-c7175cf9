import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Globe, Search, Save, Loader2, Check } from "lucide-react";

const ALL_COUNTRIES: Record<string, string> = {
  AF:"Afghanistan",AL:"Albanie",DZ:"Algérie",AD:"Andorre",AO:"Angola",AG:"Antigua-et-Barbuda",AR:"Argentine",AM:"Arménie",AU:"Australie",AT:"Autriche",AZ:"Azerbaïdjan",BS:"Bahamas",BH:"Bahreïn",BD:"Bangladesh",BB:"Barbade",BY:"Biélorussie",BE:"Belgique",BZ:"Belize",BJ:"Bénin",BT:"Bhoutan",BO:"Bolivie",BA:"Bosnie-Herzégovine",BW:"Botswana",BR:"Brésil",BN:"Brunei",BG:"Bulgarie",BF:"Burkina Faso",BI:"Burundi",KH:"Cambodge",CM:"Cameroun",CA:"Canada",CV:"Cap-Vert",CF:"Centrafrique",TD:"Tchad",CL:"Chili",CN:"Chine",CO:"Colombie",KM:"Comores",CG:"Congo",CD:"RD Congo",CR:"Costa Rica",CI:"Côte d'Ivoire",HR:"Croatie",CU:"Cuba",CY:"Chypre",CZ:"Tchéquie",DK:"Danemark",DJ:"Djibouti",DM:"Dominique",DO:"Rép. dominicaine",EC:"Équateur",EG:"Égypte",SV:"Salvador",GQ:"Guinée équatoriale",ER:"Érythrée",EE:"Estonie",SZ:"Eswatini",ET:"Éthiopie",FJ:"Fidji",FI:"Finlande",FR:"France",GA:"Gabon",GM:"Gambie",GE:"Géorgie",DE:"Allemagne",GH:"Ghana",GR:"Grèce",GD:"Grenade",GT:"Guatemala",GN:"Guinée",GW:"Guinée-Bissau",GY:"Guyana",HT:"Haïti",HN:"Honduras",HU:"Hongrie",IS:"Islande",IN:"Inde",ID:"Indonésie",IR:"Iran",IQ:"Irak",IE:"Irlande",IL:"Israël",IT:"Italie",JM:"Jamaïque",JP:"Japon",JO:"Jordanie",KZ:"Kazakhstan",KE:"Kenya",KI:"Kiribati",KP:"Corée du Nord",KR:"Corée du Sud",KW:"Koweït",KG:"Kirghizistan",LA:"Laos",LV:"Lettonie",LB:"Liban",LS:"Lesotho",LR:"Liberia",LY:"Libye",LI:"Liechtenstein",LT:"Lituanie",LU:"Luxembourg",MG:"Madagascar",MW:"Malawi",MY:"Malaisie",MV:"Maldives",ML:"Mali",MT:"Malte",MH:"Îles Marshall",MR:"Mauritanie",MU:"Maurice",MX:"Mexique",FM:"Micronésie",MD:"Moldavie",MC:"Monaco",MN:"Mongolie",ME:"Monténégro",MA:"Maroc",MZ:"Mozambique",MM:"Myanmar",NA:"Namibie",NR:"Nauru",NP:"Népal",NL:"Pays-Bas",NZ:"Nouvelle-Zélande",NI:"Nicaragua",NE:"Niger",NG:"Nigeria",MK:"Macédoine du Nord",NO:"Norvège",OM:"Oman",PK:"Pakistan",PW:"Palaos",PA:"Panama",PG:"Papouasie-Nouvelle-Guinée",PY:"Paraguay",PE:"Pérou",PH:"Philippines",PL:"Pologne",PT:"Portugal",QA:"Qatar",RO:"Roumanie",RU:"Russie",RW:"Rwanda",KN:"Saint-Kitts-et-Nevis",LC:"Sainte-Lucie",VC:"Saint-Vincent",WS:"Samoa",SM:"Saint-Marin",ST:"São Tomé-et-Príncipe",SA:"Arabie saoudite",SN:"Sénégal",RS:"Serbie",SC:"Seychelles",SL:"Sierra Leone",SG:"Singapour",SK:"Slovaquie",SI:"Slovénie",SB:"Îles Salomon",SO:"Somalie",ZA:"Afrique du Sud",SS:"Soudan du Sud",ES:"Espagne",LK:"Sri Lanka",SD:"Soudan",SR:"Suriname",SE:"Suède",CH:"Suisse",SY:"Syrie",TW:"Taïwan",TJ:"Tadjikistan",TZ:"Tanzanie",TH:"Thaïlande",TL:"Timor oriental",TG:"Togo",TO:"Tonga",TT:"Trinité-et-Tobago",TN:"Tunisie",TR:"Turquie",TM:"Turkménistan",TV:"Tuvalu",UG:"Ouganda",UA:"Ukraine",AE:"Émirats arabes unis",GB:"Royaume-Uni",US:"États-Unis",UY:"Uruguay",UZ:"Ouzbékistan",VU:"Vanuatu",VE:"Venezuela",VN:"Vietnam",YE:"Yémen",ZM:"Zambie",ZW:"Zimbabwe"
};

const ALL_CODES = Object.keys(ALL_COUNTRIES);

export default function AdminCountriesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [disabledCountries, setDisabledCountries] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("platform_settings").select("value").eq("key", "active_countries").maybeSingle().then(({ data }) => {
      if (data?.value) {
        const v = data.value as any;
        if (Array.isArray(v.disabled)) {
          setDisabledCountries(new Set(v.disabled));
        }
      }
      setLoading(false);
    });
  }, []);

  const toggleCountry = (code: string) => {
    setDisabledCountries(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const handleSelectAll = () => setDisabledCountries(new Set());
  const handleDeselectAll = () => setDisabledCountries(new Set(ALL_CODES));

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("platform_settings").upsert({
      key: "active_countries",
      value: { enabled: true, disabled: Array.from(disabledCountries) } as any,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pays enregistrés", description: `${ALL_CODES.length - disabledCountries.size} pays actifs sur ${ALL_CODES.length}.` });
    }
    setSaving(false);
  };

  const filtered = ALL_CODES.filter(c => {
    const q = search.toLowerCase();
    return c.toLowerCase().includes(q) || ALL_COUNTRIES[c].toLowerCase().includes(q);
  });

  const activeCount = ALL_CODES.length - disabledCountries.size;

  if (loading) return <AdminLayout title="Pays actifs"><div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div></AdminLayout>;

  return (
    <AdminLayout title="Pays actifs">
      <div className="max-w-3xl space-y-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Gestion des pays disponibles au checkout</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Désactivez les pays vers lesquels vous ne livrez pas. Ils n'apparaîtront plus dans le sélecteur de pays au checkout.
          </p>

          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un pays..." className="pl-9 h-9 text-sm" />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {activeCount}/{ALL_CODES.length} actifs
            </span>
          </div>

          <div className="flex gap-2 mb-3">
            <button onClick={handleSelectAll} className="text-xs px-3 py-1.5 bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
              Tout activer
            </button>
            <button onClick={handleDeselectAll} className="text-xs px-3 py-1.5 bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
              Tout désactiver
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto space-y-1 border border-border rounded-lg p-2">
            {filtered.map(code => {
              const active = !disabledCountries.has(code);
              return (
                <button
                  key={code}
                  onClick={() => toggleCountry(code)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors ${active ? "hover:bg-muted/50" : "opacity-50 hover:opacity-75"}`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${active ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                    {active && <Check size={12} />}
                  </div>
                  <span className="font-medium text-foreground">{ALL_COUNTRIES[code]}</span>
                  <span className="text-xs text-muted-foreground">({code})</span>
                </button>
              );
            })}
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Enregistrer
        </button>
      </div>
    </AdminLayout>
  );
}
