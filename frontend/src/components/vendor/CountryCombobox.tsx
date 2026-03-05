import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const COUNTRY_MAP: Record<string, string> = {
  AF:"Afghanistan",AL:"Albanie",DZ:"Algérie",AD:"Andorre",AO:"Angola",AG:"Antigua-et-Barbuda",AR:"Argentine",AM:"Arménie",AU:"Australie",AT:"Autriche",AZ:"Azerbaïdjan",BS:"Bahamas",BH:"Bahreïn",BD:"Bangladesh",BB:"Barbade",BY:"Biélorussie",BE:"Belgique",BZ:"Belize",BJ:"Bénin",BT:"Bhoutan",BO:"Bolivie",BA:"Bosnie-Herzégovine",BW:"Botswana",BR:"Brésil",BN:"Brunei",BG:"Bulgarie",BF:"Burkina Faso",BI:"Burundi",KH:"Cambodge",CM:"Cameroun",CA:"Canada",CV:"Cap-Vert",CF:"Centrafrique",TD:"Tchad",CL:"Chili",CN:"Chine",CO:"Colombie",KM:"Comores",CG:"Congo",CD:"RD Congo",CR:"Costa Rica",CI:"Côte d'Ivoire",HR:"Croatie",CU:"Cuba",CY:"Chypre",CZ:"Tchéquie",DK:"Danemark",DJ:"Djibouti",DM:"Dominique",DO:"Rép. dominicaine",EC:"Équateur",EG:"Égypte",SV:"Salvador",GQ:"Guinée équatoriale",ER:"Érythrée",EE:"Estonie",SZ:"Eswatini",ET:"Éthiopie",FJ:"Fidji",FI:"Finlande",FR:"France",GA:"Gabon",GM:"Gambie",GE:"Géorgie",DE:"Allemagne",GH:"Ghana",GR:"Grèce",GD:"Grenade",GT:"Guatemala",GN:"Guinée",GW:"Guinée-Bissau",GY:"Guyana",HT:"Haïti",HN:"Honduras",HU:"Hongrie",IS:"Islande",IN:"Inde",ID:"Indonésie",IR:"Iran",IQ:"Irak",IE:"Irlande",IL:"Israël",IT:"Italie",JM:"Jamaïque",JP:"Japon",JO:"Jordanie",KZ:"Kazakhstan",KE:"Kenya",KI:"Kiribati",KP:"Corée du Nord",KR:"Corée du Sud",KW:"Koweït",KG:"Kirghizistan",LA:"Laos",LV:"Lettonie",LB:"Liban",LS:"Lesotho",LR:"Liberia",LY:"Libye",LI:"Liechtenstein",LT:"Lituanie",LU:"Luxembourg",MG:"Madagascar",MW:"Malawi",MY:"Malaisie",MV:"Maldives",ML:"Mali",MT:"Malte",MH:"Îles Marshall",MR:"Mauritanie",MU:"Maurice",MX:"Mexique",FM:"Micronésie",MD:"Moldavie",MC:"Monaco",MN:"Mongolie",ME:"Monténégro",MA:"Maroc",MZ:"Mozambique",MM:"Myanmar",NA:"Namibie",NR:"Nauru",NP:"Népal",NL:"Pays-Bas",NZ:"Nouvelle-Zélande",NI:"Nicaragua",NE:"Niger",NG:"Nigeria",MK:"Macédoine du Nord",NO:"Norvège",OM:"Oman",PK:"Pakistan",PW:"Palaos",PA:"Panama",PG:"Papouasie-Nouvelle-Guinée",PY:"Paraguay",PE:"Pérou",PH:"Philippines",PL:"Pologne",PT:"Portugal",QA:"Qatar",RO:"Roumanie",RU:"Russie",RW:"Rwanda",KN:"Saint-Kitts-et-Nevis",LC:"Sainte-Lucie",VC:"Saint-Vincent",WS:"Samoa",SM:"Saint-Marin",ST:"São Tomé-et-Príncipe",SA:"Arabie saoudite",SN:"Sénégal",RS:"Serbie",SC:"Seychelles",SL:"Sierra Leone",SG:"Singapour",SK:"Slovaquie",SI:"Slovénie",SB:"Îles Salomon",SO:"Somalie",ZA:"Afrique du Sud",SS:"Soudan du Sud",ES:"Espagne",LK:"Sri Lanka",SD:"Soudan",SR:"Suriname",SE:"Suède",CH:"Suisse",SY:"Syrie",TW:"Taïwan",TJ:"Tadjikistan",TZ:"Tanzanie",TH:"Thaïlande",TL:"Timor oriental",TG:"Togo",TO:"Tonga",TT:"Trinité-et-Tobago",TN:"Tunisie",TR:"Turquie",TM:"Turkménistan",TV:"Tuvalu",UG:"Ouganda",UA:"Ukraine",AE:"Émirats arabes unis",GB:"Royaume-Uni",US:"États-Unis",UY:"Uruguay",UZ:"Ouzbékistan",VU:"Vanuatu",VE:"Venezuela",VN:"Vietnam",YE:"Yémen",ZM:"Zambie",ZW:"Zimbabwe"
};

const COUNTRIES = Object.keys(COUNTRY_MAP);

export function getCountryName(code: string): string {
  return COUNTRY_MAP[code] || code;
}

export function CountryCombobox({ value, onChange, label = "Pays d'origine", placeholder = "Sélectionner un pays...", noneLabel = "— Aucun —", showNone = true }: { value: string; onChange: (v: string) => void; label?: string; placeholder?: string; noneLabel?: string; showNone?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMobile]);

  // Prevent body scroll when modal is open on mobile
  useEffect(() => {
    if (isMobile && open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isMobile, open]);

  const filtered = COUNTRIES.filter((c) => {
    const name = COUNTRY_MAP[c].toLowerCase();
    const q = search.toLowerCase();
    return c.toLowerCase().includes(q) || name.includes(q);
  });

  const handleSelect = (code: string) => {
    onChange(code);
    setOpen(false);
    setSearch("");
  };

  const countryList = (
    <>
      {showNone && (
        <button
          type="button"
          onClick={() => handleSelect("")}
          className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted flex items-center gap-2"
        >
          <span className="w-4">{!value && <Check size={14} />}</span>
          {noneLabel}
        </button>
      )}
      {filtered.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => handleSelect(c)}
          className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted flex items-center gap-2"
        >
          <span className="w-4">{value === c && <Check size={14} className="text-primary" />}</span>
          <span className="font-medium">{COUNTRY_MAP[c]}</span>
          <span className="text-muted-foreground">({c})</span>
        </button>
      ))}
    </>
  );

  return (
    <div ref={ref} className="relative">
      {label && <label className="text-xs text-muted-foreground">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md flex items-center justify-between"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value ? `${COUNTRY_MAP[value] || value} (${value})` : placeholder}
        </span>
        <ChevronDown size={14} className="text-muted-foreground" />
      </button>

      {open && isMobile && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <button type="button" onClick={() => { setOpen(false); setSearch(""); }} className="text-muted-foreground">
              <X size={20} />
            </button>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher par nom ou code..."
                className="w-full pl-9 pr-3 py-2 text-base bg-muted border-none rounded-lg outline-none"
                style={{ fontSize: "16px" }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          {/* Country list */}
          <div className="flex-1 overflow-y-auto">
            {countryList}
          </div>
        </div>
      )}

      {open && !isMobile && (
        <div
          className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-52 overflow-hidden left-0 right-0"
          style={{
            position: 'fixed',
            width: ref.current?.getBoundingClientRect().width,
            left: ref.current?.getBoundingClientRect().left,
            top: (ref.current?.getBoundingClientRect().bottom || 0) + 4,
          }}
        >
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher par nom ou code..."
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-muted border-none rounded outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-40">
            {countryList}
          </div>
        </div>
      )}
    </div>
  );
}
